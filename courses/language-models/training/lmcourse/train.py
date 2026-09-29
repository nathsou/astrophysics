"""The course's PyTorch training loop (Chapter 12; scaled up for CourseGPT in Chapter 14).

    uv run lmc train --preset chargpt                 # character-level GPT on TinyShakespeare
    uv run lmc train --preset chargpt --resume        # continue from runs/chargpt/ckpt.pt
    uv run lmc train --preset chargpt --export        # write runs/chargpt/model.safetensors for the browser
    uv run lmc train --preset smoke                   # one-minute TinyStories run (after `lmc tokenise`)
    uv run lmc train --preset coursegpt               # CourseGPT
    uv run lmc train --preset coursegpt --set lr=2e-3 layers=6 name=try   # override any field

Everything Chapter 12 describes: random-window batches, gradient accumulation, warm-up + cosine
schedule, clipping, evaluation on the validation split, throughput and model FLOPs utilisation,
checkpoints with optimiser and RNG state, and a JSON-lines log. Chapter 14 adds token datasets read
through a memory map, bfloat16 autocast, `torch.compile`, and Muon.
"""

from __future__ import annotations

import dataclasses
import json
import math
import time
from dataclasses import dataclass, field

import numpy as np

from . import data
from .paths import TRAINING


@dataclass
class TrainConfig:
    name: str = "chargpt"
    data: str = "shakespeare"
    """"shakespeare" (characters, 90/10 split) or "tinystories" (BPE tokens from `lmc tokenise`)."""
    layers: int = 4
    width: int = 192
    heads: int = 6
    context: int = 256
    dropout: float = 0.1
    batch: int = 32
    accum: int = 1
    steps: int = 3000
    optimizer: str = "adamw"
    """"adamw", or "muon" (Muon for the blocks' matrices, AdamW for everything else)."""
    lr: float = 2e-3
    muon_lr: float = 0.02
    beta2: float = 0.99
    warmup: int = 200
    min_lr_ratio: float = 0.1
    weight_decay: float = 0.1
    clip: float = 1.0
    eval_every: int = 500
    eval_tokens: int = 0
    """Evaluate on the first eval_tokens of the validation split (0: all of it)."""
    compile: bool = False
    # Chapter 18's architecture options (see GPTConfig).
    norm_type: str = "layer"
    mlp_type: str = "gelu"
    pos: str = "learned"
    kv_heads: int = 0
    seed: int = 1
    notes: dict = field(default_factory=dict)


PRESETS: dict[str, TrainConfig] = {
    "quick": TrainConfig(
        name="quick", layers=2, width=128, heads=4, context=128, dropout=0.0, steps=3000, lr=3e-3, warmup=100
    ),
    "chargpt": TrainConfig(),
    "chargpt-big": TrainConfig(
        name="chargpt-big", layers=6, width=384, heads=6, context=256, dropout=0.2, steps=5000, lr=1e-3
    ),
    # TinyStories, BPE tokens. Micro-batches of 32 × 512 tokens fit easily in 16 GB.
    "smoke": TrainConfig(
        name="smoke", data="tinystories", layers=2, width=128, heads=4, context=256, dropout=0.0,
        batch=32, steps=500, lr=3e-3, warmup=50, eval_every=250, eval_tokens=1 << 20, compile=True,
    ),
    # Muon for the matrices, AdamW for the rest: the best settings of the Chapter 14 sweep (`lmc ch14 sweep`).
    "coursegpt": TrainConfig(
        name="coursegpt", data="tinystories", layers=8, width=512, heads=8, context=512, dropout=0.0,
        batch=32, accum=8, steps=8000, optimizer="muon", lr=4e-3, muon_lr=0.04, beta2=0.95, warmup=250,
        eval_every=500, eval_tokens=1 << 21, compile=True,
    ),
    # A small model with CourseGPT's tokeniser, to draft tokens for speculative decoding (Chapter 16).
    "draft": TrainConfig(
        name="draft", data="tinystories", layers=2, width=256, heads=4, context=512, dropout=0.0,
        batch=32, accum=4, steps=2000, optimizer="muon", lr=4e-3, muon_lr=0.02, beta2=0.95, warmup=100,
        eval_every=500, eval_tokens=1 << 21, compile=True,
    ),
}

# Dense bfloat16 tensor-core peaks (FLOP/s) from the vendors' specifications, for MFU.
PEAK_BF16 = {"RTX 4060 Ti": 44.1e12, "RTX 4090": 165.2e12, "A100": 312e12, "H100": 989e12}


def lr_at(step: int, c: TrainConfig, peak: float | None = None) -> float:
    peak = c.lr if peak is None else peak
    if step < c.warmup:
        return peak * (step + 1) / c.warmup
    p = min(1.0, (step - c.warmup) / max(1, c.steps - c.warmup))
    return peak * (c.min_lr_ratio + (1 - c.min_lr_ratio) * 0.5 * (1 + math.cos(math.pi * p)))


def parse_overrides(cfg: TrainConfig, pairs: list[str]) -> TrainConfig:
    """Apply `key=value` overrides, converting each value to the field's type."""
    kinds = {f.name: type(getattr(cfg, f.name)) for f in dataclasses.fields(cfg)}
    changes = {}
    for pair in pairs:
        key, _, value = pair.partition("=")
        if key not in kinds or kinds[key] is dict:
            raise SystemExit(f"unknown setting {key!r}; choose from {', '.join(k for k in kinds if k != 'notes')}")
        kind = kinds[key]
        changes[key] = value.lower() in ("1", "true", "yes") if kind is bool else kind(float(value) if kind is int else value)
    return dataclasses.replace(cfg, **changes)


def flops_per_token(n_params: int, cfg) -> float:
    """Training FLOPs per token: 6 per parameter used in a matmul, plus causal attention's 6·L·T·C.
    Position embeddings are only added, so they do not count; the token embedding is only looked up
    on the way in, but as the tied output layer it is a full (C × V) matmul, so it does."""
    pos = cfg.context * cfg.width if getattr(cfg, "pos", "learned") == "learned" else 0
    return 6 * (n_params - pos) + 6 * cfg.layers * cfg.context * cfg.width


class Dataset:
    """Training and validation token ids, and the vocabulary needed to decode them."""

    def __init__(self, name: str) -> None:
        self.name = name
        if name == "shakespeare":
            text = data.load_text("shakespeare")
            self.chars = sorted(set(text))
            index = {c: i for i, c in enumerate(self.chars)}
            ids = np.array([index[c] for c in text], dtype=np.uint16)
            split = int(len(ids) * 0.9)
            self.train, self.val = ids[:split], ids[split:]
            self.vocab = len(self.chars)
            self.unit = "char"
        elif name == "tinystories":
            from . import tokens

            self.train, self.val = tokens.load("train"), tokens.load("val")
            self.tokeniser = tokens.tokeniser()
            self.vocab = self.tokeniser.vocab_size
            self.unit = "token"
        else:
            raise SystemExit(f"unknown dataset {name!r}")

    def decode(self, ids: list[int]) -> str:
        if self.name == "shakespeare":
            return "".join(self.chars[i] for i in ids)
        return self.tokeniser.decode(ids)

    def export_metadata(self) -> dict[str, str]:
        if self.name == "shakespeare":
            return {"vocab": json.dumps(self.chars)}
        return {"tokeniser": json.dumps(self.tokeniser.to_json())}


def main(
    preset: str = "chargpt",
    resume: bool = False,
    export: bool = False,
    steps: int | None = None,
    overrides: list[str] | None = None,
) -> None:
    import torch
    import torch.nn.functional as F

    from .model import GPT, GPTConfig

    cfg = parse_overrides(PRESETS[preset], overrides or [])
    out = TRAINING / "runs" / cfg.name
    out.mkdir(parents=True, exist_ok=True)
    dev = torch.device(
        "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    )
    ckpt_path = out / "ckpt.pt"
    ckpt = torch.load(ckpt_path, map_location=dev, weights_only=False) if (resume or export) and ckpt_path.exists() else None
    if ckpt is not None:
        # Continue with the run's own settings (optimiser, learning rates…), plus any new overrides.
        cfg = parse_overrides(TrainConfig(**ckpt["config"]), overrides or [])
    if steps is not None:
        cfg.steps = steps
    use_bf16 = dev.type == "cuda" and torch.cuda.is_bf16_supported()
    torch.set_float32_matmul_precision("high")  # TF32 for any float32 matmuls left outside autocast
    torch.manual_seed(cfg.seed)
    rng = np.random.default_rng(cfg.seed)

    ds = Dataset(cfg.data)
    mcfg = GPTConfig(
        vocab=ds.vocab,
        context=cfg.context,
        width=cfg.width,
        layers=cfg.layers,
        heads=cfg.heads,
        dropout=cfg.dropout,
        norm_type=cfg.norm_type,
        mlp_type=cfg.mlp_type,
        pos=cfg.pos,
        kv_heads=cfg.kv_heads,
    )
    model = GPT(mcfg).to(dev)
    if cfg.optimizer == "muon":
        opts = model.muon_optimizers(cfg.muon_lr, cfg.lr, cfg.weight_decay, betas=(0.9, cfg.beta2))
    else:
        opts = [model.optimizer(cfg.lr, cfg.weight_decay, betas=(0.9, cfg.beta2))]
    peaks = [[g["lr"] for g in o.param_groups] for o in opts]
    step, history = 0, []
    if ckpt is not None:
        model.load_state_dict(ckpt["model"])
        for o, s in zip(opts, ckpt.get("opts") or [ckpt["opt"]], strict=True):  # "opt": before Chapter 14
            o.load_state_dict(s)
        step, history = ckpt["step"], ckpt["history"]
        torch.set_rng_state(ckpt["rng"].cpu())
        if "np_rng" in ckpt:
            rng.bit_generator.state = ckpt["np_rng"]
        print(f"Resumed {cfg.name} at step {step}")

    if export:
        from safetensors.torch import save_file

        meta = {
            "format": "lm-course-gpt",
            "config": json.dumps(dataclasses.asdict(mcfg)),
            "step": str(step),
            **ds.export_metadata(),
        }
        # Float32 for character models; bfloat16 halves CourseGPT's download (≈60 MB rather than 120).
        dtype = torch.float32 if cfg.data == "shakespeare" else torch.bfloat16
        state = {k: v.to(dtype) for k, v in model.state_for_browser().items()}
        save_file(state, out / "model.safetensors", metadata=meta)
        print(f"wrote {out / 'model.safetensors'}")
        return

    n_params = model.num_parameters()
    fpt = flops_per_token(n_params, mcfg)
    gpu_name = torch.cuda.get_device_name() if dev.type == "cuda" else ""
    peak_flops = next((v for k, v in PEAK_BF16.items() if k in gpu_name), None) if use_bf16 else None
    tokens_per_step = cfg.batch * cfg.accum * cfg.context
    print(
        f"{cfg.name}: {n_params:,} parameters on {dev}{' (bf16 autocast)' if use_bf16 else ''}; "
        f"{tokens_per_step:,} tokens per step, {tokens_per_step * cfg.steps / 1e6:,.0f} M in total "
        f"({tokens_per_step * cfg.steps / len(ds.train):.2f} epochs)"
    )
    # The compiled model shares its parameters with `model`, which we keep for saving and evaluation.
    fwd = torch.compile(model) if cfg.compile else model

    def batch(src: np.ndarray, starts: np.ndarray):
        x = torch.from_numpy(np.stack([src[s : s + cfg.context + 1] for s in starts]).astype(np.int64))
        if dev.type == "cuda":
            x = x.pin_memory().to(dev, non_blocking=True)
        else:
            x = x.to(dev)
        return x[:, :-1], x[:, 1:]

    @torch.no_grad()
    def evaluate() -> float:
        """Mean loss over non-overlapping windows of the validation split, in bits per token (or char)."""
        model.eval()
        val = ds.val if cfg.eval_tokens == 0 else ds.val[: cfg.eval_tokens + 1]
        n = (len(val) - 1) // cfg.context
        total = 0.0
        for i in range(0, n, cfg.batch):
            x, y = batch(val, np.arange(i, min(n, i + cfg.batch)) * cfg.context)
            with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=use_bf16):
                logits, _ = model(x)  # uncompiled: the last batch's shape would trigger a recompilation
            total += F.cross_entropy(logits.float().reshape(-1, mcfg.vocab), y.reshape(-1), reduction="sum").item()
        model.train()
        return total / (n * cfg.context) / math.log(2)

    def sample(tokens: int = 120, seed: int = 0) -> str:
        """A story opening from a lone <|endoftext|>, with a fixed seed so checkpoints are comparable."""
        start = torch.full((1, 1), ds.tokeniser.special["<|endoftext|>"], device=dev)
        g = torch.Generator(device=dev).manual_seed(seed)
        model.eval()
        with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=use_bf16):
            ids = model.generate(start, tokens, temperature=0.8, generator=g)[0].tolist()
        model.train()
        return ds.decode(ids[1:])

    log = (out / "log.jsonl").open("a")
    if step == 0:
        log.write(json.dumps({"config": dataclasses.asdict(cfg), "params": n_params, "flops_per_token": fpt}) + "\n")
    t0, tokens, started = time.time(), 0, time.time()
    while step < cfg.steps:
        for o, pk in zip(opts, peaks, strict=True):
            for g, p in zip(o.param_groups, pk, strict=True):
                g["lr"] = lr_at(step, cfg, p)
        loss_sum = torch.zeros((), device=dev)
        for _ in range(cfg.accum):
            x, y = batch(ds.train, rng.integers(0, len(ds.train) - cfg.context - 1, cfg.batch))
            with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=use_bf16):
                _, loss = fwd(x, y)
            (loss / cfg.accum).backward()
            loss_sum += loss.detach() / cfg.accum  # no .item(): it would make the CPU wait for the GPU
            tokens += x.numel()
        norm = torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.clip)
        for o in opts:
            o.step()
        model.zero_grad(set_to_none=True)
        step += 1
        if step % 100 == 0 or step == cfg.steps:
            train_bits = loss_sum.item() / math.log(2)  # one synchronisation per 100 steps
            dt = time.time() - t0
            record = {
                "step": step,
                "train_bits": train_bits,
                "lr": lr_at(step, cfg),
                "grad_norm": norm.item(),
                "tokens_per_s": tokens / dt,
                "tflops": tokens * fpt / dt / 1e12,
                "elapsed": time.time() - started,
            }
            if peak_flops:
                record["mfu"] = tokens * fpt / dt / peak_flops
            log.write(json.dumps(record) + "\n")
            log.flush()
            if step % cfg.eval_every != 0 and step != cfg.steps:
                mfu = f", MFU {record['mfu']:.0%}" if peak_flops else ""
                print(f"  step {step:>6}: train {train_bits:.3f}  {tokens / dt:,.0f} tok/s{mfu}")
            t0, tokens = time.time(), 0
        if step % cfg.eval_every == 0 or step == cfg.steps:
            v = evaluate()
            history.append({"step": step, "val_bits": v})
            record = {"step": step, "val_bits": v, "elapsed": time.time() - started}
            if cfg.data == "tinystories":
                record["sample"] = sample()
            log.write(json.dumps(record) + "\n")
            log.flush()
            print(f"  step {step:>6}: train {loss_sum.item() / math.log(2):.3f}  val {v:.3f} bits/{ds.unit}")
            torch.save(
                {
                    "model": model.state_dict(),
                    "opts": [o.state_dict() for o in opts],
                    "step": step,
                    "history": history,
                    "rng": torch.get_rng_state(),
                    "np_rng": rng.bit_generator.state,
                    "config": dataclasses.asdict(cfg),
                },
                ckpt_path,
            )
            t0 = time.time()  # evaluation time does not count against throughput
    best = min(h["val_bits"] for h in history)
    print(f"best validation: {best:.3f} bits/{ds.unit}; checkpoint in {ckpt_path}")
    if cfg.data == "tinystories":
        print(sample(200, seed=1))

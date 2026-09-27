"""The course's PyTorch training loop (Chapter 12; CourseGPT in Chapter 14).

    uv run lmc train --preset chargpt                 # character-level GPT on TinyShakespeare
    uv run lmc train --preset chargpt --resume        # continue from runs/chargpt/ckpt.pt
    uv run lmc train --preset chargpt --export        # write runs/chargpt/model.safetensors for the browser

Everything the chapter describes: random-window batches, gradient accumulation, warm-up + cosine
schedule, clipping (norm logged), evaluation on the whole validation split, throughput and model
FLOPs utilisation, bfloat16 autocast on CUDA, checkpoints with optimiser and RNG state, and a
JSON-lines log.
"""

from __future__ import annotations

import dataclasses
import json
import math
import time
from dataclasses import dataclass, field

from . import data
from .paths import TRAINING


@dataclass
class TrainConfig:
    name: str = "chargpt"
    layers: int = 4
    width: int = 192
    heads: int = 6
    context: int = 256
    dropout: float = 0.1
    batch: int = 32
    accum: int = 1
    steps: int = 3000
    lr: float = 2e-3
    warmup: int = 200
    min_lr_ratio: float = 0.1
    weight_decay: float = 0.1
    clip: float = 1.0
    eval_every: int = 500
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
}


def lr_at(step: int, c: TrainConfig) -> float:
    if step < c.warmup:
        return c.lr * (step + 1) / c.warmup
    p = min(1.0, (step - c.warmup) / max(1, c.steps - c.warmup))
    return c.lr * (c.min_lr_ratio + (1 - c.min_lr_ratio) * 0.5 * (1 + math.cos(math.pi * p)))


def main(
    preset: str = "chargpt", resume: bool = False, export: bool = False, steps: int | None = None
) -> None:
    import torch
    import torch.nn.functional as F

    from .model import GPT, GPTConfig

    cfg = dataclasses.replace(PRESETS[preset])
    if steps is not None:
        cfg.steps = steps
    out = TRAINING / "runs" / cfg.name
    out.mkdir(parents=True, exist_ok=True)
    dev = torch.device(
        "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    )
    use_bf16 = dev.type == "cuda" and torch.cuda.is_bf16_supported()
    torch.manual_seed(cfg.seed)

    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    index = {c: i for i, c in enumerate(chars)}
    ids = torch.tensor([index[c] for c in text], dtype=torch.long)
    split = int(len(ids) * 0.9)
    train, val = ids[:split].to(dev), ids[split:].to(dev)

    mcfg = GPTConfig(
        vocab=len(chars),
        context=cfg.context,
        width=cfg.width,
        layers=cfg.layers,
        heads=cfg.heads,
        dropout=cfg.dropout,
    )
    model = GPT(mcfg).to(dev)
    opt = model.optimizer(cfg.lr, cfg.weight_decay)
    step, history = 0, []
    ckpt_path = out / "ckpt.pt"
    if (resume or export) and ckpt_path.exists():
        ckpt = torch.load(ckpt_path, map_location=dev, weights_only=False)
        model.load_state_dict(ckpt["model"])
        opt.load_state_dict(ckpt["opt"])
        step, history = ckpt["step"], ckpt["history"]
        torch.set_rng_state(ckpt["rng"].cpu())
        print(f"Resumed {cfg.name} at step {step}")

    if export:
        from safetensors.torch import save_file

        meta = {
            "format": "lm-course-gpt",
            "config": json.dumps(dataclasses.asdict(mcfg)),
            "vocab": json.dumps(chars),
            "step": str(step),
        }
        save_file(model.state_for_browser(), out / "model.safetensors", metadata=meta)
        print(f"wrote {out / 'model.safetensors'}")
        return

    n_params = model.num_parameters()
    embedding = mcfg.vocab * mcfg.width + mcfg.context * mcfg.width
    flops_per_token = 6 * (n_params - embedding) + 6 * cfg.layers * cfg.context * cfg.width
    print(f"{cfg.name}: {n_params:,} parameters on {dev}{' (bf16 autocast)' if use_bf16 else ''}")

    def batch(src):
        starts = torch.randint(len(src) - cfg.context - 1, (cfg.batch,), device=dev)
        offs = torch.arange(cfg.context, device=dev)
        return src[starts[:, None] + offs], src[starts[:, None] + offs + 1]

    @torch.no_grad()
    def evaluate() -> float:
        model.eval()
        n = (len(val) - 1) // cfg.context
        x = val[: n * cfg.context].view(n, cfg.context)
        y = val[1 : n * cfg.context + 1].view(n, cfg.context)
        total = 0.0
        for i in range(0, n, 32):
            with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=use_bf16):
                logits, _ = model(x[i : i + 32])
            total += F.cross_entropy(
                logits.float().reshape(-1, mcfg.vocab), y[i : i + 32].reshape(-1), reduction="sum"
            ).item()
        model.train()
        return total / (n * cfg.context) / math.log(2)

    log = (out / "log.jsonl").open("a")
    t0, tokens = time.time(), 0
    while step < cfg.steps:
        for g in opt.param_groups:
            g["lr"] = lr_at(step, cfg)
        loss_sum = 0.0
        for _ in range(cfg.accum):
            x, y = batch(train)
            with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=use_bf16):
                _, loss = model(x, y)
            (loss / cfg.accum).backward()
            loss_sum += loss.item() / cfg.accum
            tokens += x.numel()
        norm = torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.clip).item()
        opt.step()
        opt.zero_grad(set_to_none=True)
        step += 1
        if step % 100 == 0:
            dt = time.time() - t0
            record = {
                "step": step,
                "train_bits": loss_sum / math.log(2),
                "lr": lr_at(step, cfg),
                "grad_norm": norm,
                "tokens_per_s": tokens / dt,
                "tflops": tokens * flops_per_token / dt / 1e12,
            }
            log.write(json.dumps(record) + "\n")
            t0, tokens = time.time(), 0
        if step % cfg.eval_every == 0 or step == cfg.steps:
            v = evaluate()
            history.append({"step": step, "val_bits": v})
            log.write(json.dumps({"step": step, "val_bits": v}) + "\n")
            log.flush()
            print(
                f"  step {step:>6}: train {loss_sum / math.log(2):.3f}  val {v:.3f} bits/char  (grad norm {norm:.2f})"
            )
            torch.save(
                {
                    "model": model.state_dict(),
                    "opt": opt.state_dict(),
                    "step": step,
                    "history": history,
                    "rng": torch.get_rng_state(),
                    "config": dataclasses.asdict(cfg),
                },
                ckpt_path,
            )
    print(f"best validation: {min(h['val_bits'] for h in history):.3f} bits/char; checkpoint in {ckpt_path}")

"""Chapter 20 — fine-tuning CourseGPT to follow instructions, fully and with LoRA.

    uv run lmc ch20 finetune    # base, full fine-tuning and LoRA at ranks 1, 4 and 16 (≈ 20 min on an RTX 4060 Ti)
    uv run lmc ch20 evaluate    # instruction following and forgetting, for each
    uv run lmc ch20 export      # the LoRA r = 16 model, merged, for the browser
    uv run lmc ch20 summary     # collect into course/content/chapters/20-fine-tuning/data.json

The task: CourseGPT only continues stories. We teach it an instruction format built from TinyStories itself,

    Write a story about Lily that uses the words: garden, puppy, rainbow.
    Story: Once upon a time …<|endoftext|>

where the name and the three words are taken from the story that follows, so the target story always satisfies
the instruction. The loss is computed only on the story, not on the instruction (loss masking).
"""

from __future__ import annotations

import json
import math
import random
import re
import time
from collections import Counter

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch20"
CHAPTER = ROOT / "course" / "content" / "chapters" / "20-fine-tuning"
CONTEXT = 512
NAME = re.compile(r"\bnamed ([A-Z][a-z]+)")
WORD = re.compile(r"\b[a-z]{4,}\b")


def instruction(name: str, words: list[str]) -> str:
    return f"Write a story about {name} that uses the words: {', '.join(words)}.\nStory: "


def examples(split: str, n: int, seed: int = 0) -> list[dict]:
    """Instruction–story pairs: the name after "named", and three words that occur in fewer than 3% of stories
    (so they are specific to this one) but in more than 0.02% (so the model knows them)."""
    from . import data, tokens

    fname = "TinyStoriesV2-GPT4-valid.txt" if split == "val" else "TinyStoriesV2-GPT4-train.txt"
    path = data.DATA / fname
    with open(path, encoding="utf-8") as f:
        text = f.read(None if split == "val" else 200_000_000)
    stories = tokens.stories(text)
    df = Counter(w for s in stories for w in set(WORD.findall(s)))
    lo, hi = 0.0002 * len(stories), 0.03 * len(stories)
    rng = random.Random(seed)
    out = []
    for s in stories:
        m = NAME.search(s)
        if not m:
            continue
        words = sorted({w for w in WORD.findall(s) if lo < df[w] < hi})
        if len(words) < 3:
            continue
        out.append({"name": m.group(1), "words": rng.sample(words, 3), "story": s})
        if len(out) >= n:
            break
    return out


def encode(ex: dict, tok) -> tuple[list[int], int]:
    """Token ids of EOT + instruction + story + EOT, and the index where the story starts."""
    eot = tok.special["<|endoftext|>"]
    prompt = [eot, *tok.encode(instruction(ex["name"], ex["words"]))]
    story = [*tok.encode(ex["story"]), eot]
    return (prompt + story)[: CONTEXT + 1], len(prompt)


def add_lora(model, rank: int, alpha: float, targets: tuple[str, ...] = ("attn.q", "attn.k", "attn.v", "attn.o", "mlp.fc", "mlp.proj")):
    """Freeze the model and give each targeted matrix a low-rank update: W + (α/r)·A·B, with A (in × r) random
    and B (r × out) zero, so training starts from the unchanged model. Returns the LoRA parameters."""
    import torch
    import torch.nn.utils.parametrize as P
    from torch import nn

    class LoRA(nn.Module):
        def __init__(self, shape: tuple[int, int]):
            super().__init__()
            self.A = nn.Parameter(torch.randn(shape[0], rank) / math.sqrt(shape[0]))
            self.B = nn.Parameter(torch.zeros(rank, shape[1]))
            self.scale = alpha / rank

        def forward(self, W):
            return W + self.scale * (self.A @ self.B).to(W.dtype)

    for p in model.parameters():
        p.requires_grad_(False)
    params = []
    for block in model.blocks:
        for t in targets:
            owner, key = t.split(".")
            d = getattr(block, owner)
            lora = LoRA(tuple(d[key].shape)).to(d[key].device)
            P.register_parametrization(d, key, lora)
            params += [lora.A, lora.B]
    return params


def _model(dev):
    import torch

    from .model import GPT, GPTConfig

    ckpt = torch.load(TRAINING / "runs" / "coursegpt" / "ckpt.pt", map_location=dev, weights_only=False)
    c = ckpt["config"]
    model = GPT(GPTConfig(vocab=8192, context=c["context"], width=c["width"], layers=c["layers"], heads=c["heads"])).to(dev)
    model.load_state_dict(ckpt["model"])
    return model


SETTINGS = {
    "full": {"label": "Full fine-tuning", "lr": 1e-4},
    "lora16": {"label": "LoRA, rank 16", "rank": 16, "lr": 2e-3},
    "lora4": {"label": "LoRA, rank 4", "rank": 4, "lr": 2e-3},
    "lora1": {"label": "LoRA, rank 1", "rank": 1, "lr": 2e-3},
}


def finetune(steps: int = 3000, batch: int = 32) -> None:
    import numpy as np
    import torch
    import torch.nn.functional as F

    from . import tokens

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tok = tokens.tokeniser()
    train = [encode(e, tok) for e in examples("train", 40_000)]
    print(f"{len(train):,} training examples")
    rng = np.random.default_rng(0)
    order = rng.permutation(steps * batch) % len(train)
    logs = {}
    for key, s in SETTINGS.items():
        torch.manual_seed(0)
        model = _model(dev)
        params = add_lora(model, s["rank"], alpha=2 * s["rank"]) if "rank" in s else list(model.parameters())
        trainable = sum(p.numel() for p in params)
        opt = torch.optim.AdamW(params, lr=s["lr"], weight_decay=0.0)
        model.train()
        curve, t0 = [], time.time()
        torch.cuda.reset_peak_memory_stats() if dev.type == "cuda" else None
        for step in range(steps):
            lr = s["lr"] * min(1, (step + 1) / 30) * 0.5 * (1 + math.cos(math.pi * step / steps))
            for g in opt.param_groups:
                g["lr"] = lr
            items = [train[i] for i in order[step * batch : (step + 1) * batch]]
            T = max(len(ids) for ids, _ in items) - 1
            x = torch.zeros(len(items), T, dtype=torch.long)
            y = torch.full((len(items), T), -100, dtype=torch.long)  # −100: ignored by cross_entropy
            for r, (ids, start) in enumerate(items):
                x[r, : len(ids) - 1] = torch.tensor(ids[:-1])
                # Loss only where the target is a story token: predicting the instruction is not the task.
                y[r, start - 1 : len(ids) - 1] = torch.tensor(ids[start:])
            x, y = x.to(dev), y.to(dev)
            with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=dev.type == "cuda"):
                logits, _ = model(x)
            loss = F.cross_entropy(logits.float().reshape(-1, logits.shape[-1]), y.reshape(-1), ignore_index=-100)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(params, 1.0)
            opt.step()
            opt.zero_grad(set_to_none=True)
            if step % 20 == 0 or step == steps - 1:
                curve.append([step, round(loss.item() / math.log(2), 4)])
        mem = torch.cuda.max_memory_allocated() / 2**30 if dev.type == "cuda" else 0
        logs[key] = {"trainable": trainable, "seconds": time.time() - t0, "memory_gib": mem, "curve": curve}
        print(f"{key}: {trainable:,} trainable parameters, final loss {curve[-1][1]:.3f} bits, {time.time() - t0:.0f} s, {mem:.2f} GiB")
        # Save the fine-tuned weights (merged: parametrisations removed, keeping W + ΔW).
        if "rank" in s:
            import torch.nn.utils.parametrize as P

            for block in model.blocks:
                for owner in ("attn", "mlp"):
                    d = getattr(block, owner)
                    for k in list(d.keys()):
                        if P.is_parametrized(d, k):
                            P.remove_parametrizations(d, k, leave_parametrized=True)
        OUT.mkdir(parents=True, exist_ok=True)
        torch.save(model.state_dict(), OUT / f"{key}.pt")
    (OUT / "finetune.json").write_text(json.dumps(logs))


def evaluate(n: int = 200) -> None:
    import torch
    import torch.nn.functional as F

    from . import tokens
    from .sampling import Sampler, generate

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tok = tokens.tokeniser()
    eot = tok.special["<|endoftext|>"]
    tests = examples("val", n, seed=1)
    val = torch.from_numpy(tokens.load("val")[: (1 << 20) + 1].astype("int64")).to(dev)
    xs, ys = val[:-1].view(-1, CONTEXT), val[1:].view(-1, CONTEXT)
    results, samples = {}, {}
    for key in ["base", *SETTINGS]:
        model = _model(dev)
        if key != "base":
            model.load_state_dict(torch.load(OUT / f"{key}.pt", map_location=dev))
        model.eval()
        with torch.no_grad():
            total = sum(F.cross_entropy(model(xs[i : i + 32])[0].float().transpose(1, 2), ys[i : i + 32], reduction="sum").item()
                        for i in range(0, len(xs), 32))
        story_bits = total / ys.numel() / math.log(2)
        ok_words = ok_name = ok_all = 0
        g = torch.Generator(device=dev).manual_seed(0)
        for i, ex in enumerate(tests):
            prompt = torch.tensor([[eot, *tok.encode(instruction(ex["name"], ex["words"]))]], device=dev)
            out = generate(model, prompt, 200, Sampler(temperature=0.7, top_p=0.9), generator=g)[0, prompt.shape[1] :].tolist()
            text = tok.decode(out[: out.index(eot)] if eot in out else out)
            words = sum(bool(re.search(rf"\b{w}\b", text, re.IGNORECASE)) for w in ex["words"])
            ok_words += words / 3
            name = ex["name"] in text
            ok_name += name
            ok_all += name and words == 3
            if i < 3:
                samples.setdefault(key, []).append({"instruction": instruction(ex["name"], ex["words"]).strip(), "story": text})
        results[key] = {"words": ok_words / n, "name": ok_name / n, "all": ok_all / n, "story_bits": story_bits}
        print(f"{key:<7} words {ok_words / n:.0%}  name {ok_name / n:.0%}  all {ok_all / n:.0%}  plain-story loss {story_bits:.3f}")
    (OUT / "evaluate.json").write_text(json.dumps({"results": results, "samples": samples, "n": n}, ensure_ascii=False))


def export() -> None:
    """The merged LoRA r = 16 model as a browser safetensors file (bfloat16), next to CourseGPT's."""
    import torch
    from safetensors.torch import save_file

    dev = torch.device("cpu")
    model = _model(dev)
    model.load_state_dict(torch.load(OUT / "lora16.pt", map_location=dev))
    meta = {"format": "lm-course-gpt", "config": json.dumps({"vocab": 8192, "context": 512, "width": 512, "layers": 8, "heads": 8}),
            "step": "0", "finetune": "instructions (Chapter 20), LoRA r = 16, merged"}
    path = OUT / "coursegpt-instruct.safetensors"
    save_file({k: v.to(torch.bfloat16) for k, v in model.state_for_browser().items()}, path, metadata=meta)
    print(f"wrote {path}")


def spectrum() -> None:
    """Singular values of the weight change made by full fine-tuning, for a few matrices: if most of the
    change lies in a few directions, a low-rank update can capture it."""
    import torch

    base = _model(torch.device("cpu")).state_dict()
    full = torch.load(OUT / "full.pt", map_location="cpu")
    out = {}
    for name in ("blocks.0.attn.q", "blocks.4.attn.v", "blocks.4.mlp.fc", "blocks.7.mlp.proj"):
        s = torch.linalg.svdvals((full[name] - base[name]).float())
        energy = (s**2).cumsum(0) / (s**2).sum()
        out[name.replace("blocks.", "h")] = {"singular": [round(v, 6) for v in s[:64].tolist()],
                                            "energy": [round(v, 4) for v in energy[:64].tolist()], "rank": len(s)}
        print(name, "energy in top 1/4/16:", [round(energy[i].item(), 3) for i in (0, 3, 15)])
    (OUT / "spectrum.json").write_text(json.dumps(out))


def summary() -> None:
    out = {"settings": {k: v["label"] for k, v in SETTINGS.items()}}
    for name in ("finetune", "evaluate", "spectrum"):
        if (OUT / f"{name}.json").exists():
            out[name] = json.loads((OUT / f"{name}.json").read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

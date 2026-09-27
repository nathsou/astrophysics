"""Chapter 16 — inference: the measurements quoted in the chapter.

    uv run lmc ch16 quant         # validation loss of CourseGPT with weights rounded to 8, 4, 3 and 2 bits
    uv run lmc ch16 speculative   # how many draft tokens CourseGPT accepts (needs the draft preset trained)
    uv run lmc ch16 weights       # a sample of CourseGPT's weights for the quantisation widget
    uv run lmc ch16 summary       # collect into course/content/chapters/16-inference/data.json
"""

from __future__ import annotations

import json
import math

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch16"
CHAPTER = ROOT / "course" / "content" / "chapters" / "16-inference"


def fake_quantise(w, bits: int, group: int | None, dim: int):
    """Round w to `bits`-bit integers with absmax scales, one per group of `group` consecutive entries
    along `dim` (or one per whole slice along `dim` when group is None), and scale back."""
    import torch

    qmax = 2 ** (bits - 1) - 1
    x = w.movedim(dim, -1)
    shape = x.shape
    if group:
        x = x.reshape(*shape[:-1], shape[-1] // group, group)
    scale = x.abs().amax(-1, keepdim=True).clamp_min(1e-12) / qmax
    q = torch.round(x / scale).clamp(-qmax, qmax) * scale
    return q.reshape(shape).movedim(-1, dim)


def quant(run: str = "coursegpt") -> None:
    import torch
    import torch.nn.functional as F

    from . import tokens
    from .ch15 import load

    model, _, dev = load(run)
    torch.set_float32_matmul_precision("highest")  # exact float32, so small quantisation effects are not masked
    val = torch.from_numpy(tokens.load("val")[: (1 << 20) + 1].astype("int64")).to(dev)
    T = model.cfg.context
    n = (len(val) - 1) // T
    x, y = val[: n * T].view(n, T), val[1 : n * T + 1].view(n, T)
    original = {k: v.detach().clone() for k, v in model.state_dict().items()}

    @torch.no_grad()
    def loss() -> float:
        total = 0.0
        for i in range(0, n, 32):
            logits, _ = model(x[i : i + 32])
            total += F.cross_entropy(logits.float().flatten(0, 1), y[i : i + 32].flatten(), reduction="sum").item()
        return total / (n * T) / math.log(2)

    settings = [("float32", 32, None), ("int8, per channel", 8, None), ("int4, per channel", 4, None),
                ("int4, groups of 32", 4, 32), ("int3, groups of 32", 3, 32), ("int2, groups of 32", 2, 32)]
    results = []
    for label, bits, group in settings:
        state = {}
        for k, v in original.items():
            if bits < 32 and v.ndim == 2 and k != "pos":
                # Linear weights are stored (in, out): scales per output column, groups along the input.
                # The token embedding (V, C) is used as hᵀ·E: scales per row, groups along C.
                state[k] = fake_quantise(v, bits, group, dim=1 if k == "tok" else 0)
            else:
                state[k] = v
        model.load_state_dict(state)
        bpt = loss()
        params = sum(v.numel() for k, v in original.items() if v.ndim == 2 and k != "pos")
        others = sum(v.numel() for k, v in original.items()) - params
        scales = params / group if group else sum(v.shape[0 if k == "tok" else 1] for k, v in original.items() if v.ndim == 2 and k != "pos")
        size = (params * bits / 8 + scales * 2 + others * 4) if bits < 32 else 4 * (params + others)
        results.append({"label": label, "bits": bits, "group": group, "val_bits": bpt, "megabytes": size / 1e6})
        print(f"{label:<22} {bpt:.4f} bits/token   {size / 1e6:6.1f} MB")
    model.load_state_dict(original)
    _write("quant", {"run": run, "tokens": n * T, "results": results})


def speculative(run: str = "coursegpt", draft: str = "draft", prompts: int = 40, length: int = 128) -> None:
    """Speculative sampling at T = 1 with the draft model proposing γ tokens: the mean number of tokens
    produced per target forward pass, for γ = 1 … 8."""
    import numpy as np
    import torch

    from . import tokens
    from .ch15 import load

    target, tok, dev = load(run)
    small, _, _ = load(draft)
    eot = tok.special["<|endoftext|>"]
    val = np.asarray(tokens.load("val"))
    starts = np.flatnonzero(val == eot)[:prompts]
    g = torch.Generator(device=dev).manual_seed(0)

    @torch.no_grad()
    def probs(model, ids: list[int]):
        logits, _ = model(torch.tensor([ids[-model.cfg.context :]], device=dev))
        return logits[0].float().softmax(-1)

    results = []
    for gamma in range(1, 9):
        passes = produced = accepted_total = proposed = 0
        for s in starts:
            ids = val[s : s + 9].tolist()
            goal = len(ids) + length
            while len(ids) < goal:
                drafts, qs = [], []
                for _ in range(gamma):
                    q = probs(small, ids + drafts)[-1]
                    drafts.append(int(torch.multinomial(q, 1, generator=g)))
                    qs.append(q)
                p = probs(target, ids + drafts)[-gamma - 1 :]
                passes += 1
                out, accepted = [], 0
                for i, x in enumerate(drafts):
                    if torch.rand(1, generator=g, device=dev) * qs[i][x] < p[i][x]:
                        out.append(x)
                        accepted += 1
                        continue
                    out.append(int(torch.multinomial((p[i] - qs[i]).clamp_min(0), 1, generator=g)))
                    break
                else:
                    out.append(int(torch.multinomial(p[gamma], 1, generator=g)))
                accepted_total += accepted
                proposed += gamma
                ids += out
                produced += len(out)
        r = {"gamma": gamma, "tokens_per_pass": produced / passes, "acceptance": accepted_total / proposed}
        results.append(r)
        print(f"γ = {gamma}: {r['tokens_per_pass']:.2f} tokens per target pass, {r['acceptance']:.0%} of drafts accepted")
    _write("speculative", {"run": run, "draft": draft, "results": results})


def weights(run: str = "coursegpt", columns: int = 8) -> None:
    """A sample of real weights for the quantisation widget: the first `columns` output columns (all
    512 inputs) of an MLP matrix and an attention matrix of the middle block."""
    import torch

    ckpt = torch.load(TRAINING / "runs" / run / "ckpt.pt", map_location="cpu", weights_only=False)
    state = ckpt["model"]
    mid = ckpt["config"]["layers"] // 2
    out = {}
    for name in (f"blocks.{mid}.mlp.fc", f"blocks.{mid}.attn.q"):
        w = state[name].float()[:, :columns]  # (in, columns)
        out[name.replace("blocks.", "h")] = {"rows": w.shape[0], "cols": columns, "values": [float(f"{v:.5g}") for v in w.T.flatten().tolist()]}
    _write("weights", out)
    print(f"wrote {OUT / 'weights.json'}")


def _write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, indent=1))


def summary() -> None:
    out = {}
    for name in ("quant", "speculative", "weights"):
        path = OUT / f"{name}.json"
        if path.exists():
            out[name] = json.loads(path.read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

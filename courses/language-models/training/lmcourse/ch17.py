"""Chapter 17 — scaling laws, measured on TinyStories with CourseGPT's architecture.

    uv run lmc ch17 sweep       # 17 small runs at three compute budgets (≈ 75 min on an RTX 4060 Ti)
    uv run lmc ch17 fit         # IsoFLOP minima, the power law for the optimal size, and L(N, D)
    uv run lmc ch17 summary     # collect into course/content/chapters/17-scaling-laws/data.json

Every run uses the same recipe as CourseGPT (Muon 0.04 for the matrices, AdamW 4e-3 for the rest,
context 512), 64 × 512 = 32,768 tokens per step, a warm-up of 5% of the run and a cosine decay over
exactly the run's length: a run shortened by cutting a longer one's schedule would look worse than it is.
"""

from __future__ import annotations

import json
import math

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch17"
CHAPTER = ROOT / "course" / "content" / "chapters" / "17-scaling-laws"

# (layers, width): head size 64 throughout, so heads = width / 64.
SHAPES = [(2, 128), (3, 192), (4, 256), (5, 320), (6, 384), (8, 512), (10, 640)]
BUDGETS = [1e15, 2.5e15, 6.25e15]
# Skip the runs far from each budget's optimum: the largest shapes at the small budgets, the smallest
# at the large one. (10 × 640 was added so that the largest budget's minimum is bracketed.)
SKIP = {(8, 512, 1e15), (10, 640, 1e15), (10, 640, 2.5e15), (2, 128, 6.25e15)}
CONTEXT = 512
BATCH = 64  # sequences per step: 32,768 tokens
# The first sweep used 16 sequences (8,192 tokens) per step, too few: see the chapter. Its runs are kept
# under the old names, and `summary` includes them for comparison.
FIRST_BATCH = 16


def params(layers: int, width: int, vocab: int = 8192) -> dict[str, int]:
    """Parameter counts of our GPT: non-embedding (blocks), and total."""
    blocks = 12 * layers * width * width + (4 * layers + 2) * width
    return {"non_embedding": blocks, "total": blocks + vocab * width + CONTEXT * width}


def flops_per_token(layers: int, width: int, vocab: int = 8192) -> float:
    """As in Chapter 14: 6 per parameter used in a matmul (the tied output layer counts), plus attention."""
    return 6 * (12 * layers * width * width + vocab * width) + 6 * layers * CONTEXT * width


def run_name(layers: int, width: int, budget: float, batch: int = BATCH) -> str:
    suffix = "" if batch == FIRST_BATCH else f"-b{batch}"
    return f"scale-{budget:.2g}-{layers}x{width}{suffix}".replace("+", "")


def plan(batch: int = BATCH) -> list[dict]:
    runs = []
    for budget in BUDGETS:
        for layers, width in SHAPES:
            if (layers, width, budget) in SKIP:
                continue
            fpt = flops_per_token(layers, width)
            tokens = budget / fpt
            steps = round(tokens / (batch * CONTEXT))
            runs.append({"name": run_name(layers, width, budget, batch), "layers": layers, "width": width, "budget": budget,
                         "batch": batch, "steps": steps, "tokens": steps * batch * CONTEXT, "flops_per_token": fpt,
                         **params(layers, width)})
    return runs


def _final(name: str) -> dict | None:
    path = TRAINING / "runs" / name / "log.jsonl"
    if not path.exists():
        return None
    recs = [json.loads(line) for line in path.read_text().splitlines()]
    vals = [r for r in recs if "val_bits" in r]
    return vals[-1] if vals else None


def sweep() -> None:
    from . import train

    for r in plan():
        if _final(r["name"]) and _final(r["name"])["step"] == r["steps"]:
            print(f"{r['name']}: done")
            continue
        (TRAINING / "runs" / r["name"] / "log.jsonl").unlink(missing_ok=True)
        print(f"== {r['name']}: {r['total'] / 1e6:.1f} M parameters, {r['tokens'] / 1e6:.0f} M tokens, {r['steps']} steps")
        warmup = min(250, max(50, r["steps"] // 20))
        train.main("coursegpt", overrides=[
            f"name={r['name']}", f"layers={r['layers']}", f"width={r['width']}", f"heads={r['width'] // 64}",
            f"context={CONTEXT}", f"batch={r['batch']}", "accum=1", f"steps={r['steps']}", f"warmup={warmup}",
            f"eval_every={r['steps']}", "eval_tokens=1048576",
        ])


def results(batch: int = BATCH) -> list[dict]:
    out = []
    for r in plan(batch):
        f = _final(r["name"])
        if f and f["step"] == r["steps"]:
            out.append({**r, "val_bits": f["val_bits"], "seconds": f["elapsed"]})
    return out


def _fit_law(rows: list[dict], key: str):
    """Fit L(N, D) = E + A / N^α + B / D^β (in bits per token) by minimising the Huber loss of
    log L, as Hoffmann et al. did, from several starting points."""
    import torch

    N = torch.tensor([r[key] for r in rows], dtype=torch.float64)
    D = torch.tensor([r["tokens"] for r in rows], dtype=torch.float64)
    L = torch.tensor([r["val_bits"] for r in rows], dtype=torch.float64)
    def objective(p):
        e, lA, lB, al, be = p
        pred = torch.exp(e) + torch.exp(lA - al * torch.log(N)) + torch.exp(lB - be * torch.log(D))
        return torch.nn.functional.huber_loss(torch.log(pred), torch.log(L), delta=1e-3, reduction="sum")

    def solve(start: list[float]):
        # E, A and B are parameterised through their logs so that they stay positive.
        p = torch.tensor(start, dtype=torch.float64, requires_grad=True)
        opt = torch.optim.LBFGS([p], max_iter=500, line_search_fn="strong_wolfe")

        def closure():
            opt.zero_grad()
            loss = objective(p)
            loss.backward()
            return loss

        opt.step(closure)
        return objective(p).item(), p.detach()

    best = None
    for a0 in (0.2, 0.4, 0.6):
        for b0 in (0.2, 0.4, 0.6):
            for e0 in (0.5, 1.0):
                try:
                    loss, p = solve([math.log(e0), 5.0, 5.0, a0, b0])
                except RuntimeError:
                    continue
                if math.isfinite(loss) and (best is None or loss < best[0]):
                    best = (loss, p)
    assert best is not None
    e, lA, lB, al, be = best[1].tolist()
    return {"E": math.exp(e), "A": math.exp(lA), "B": math.exp(lB), "alpha": al, "beta": be}


def fit() -> None:
    import numpy as np

    rows = results()
    budgets = sorted({r["budget"] for r in rows})
    minima = []
    for c in budgets:
        pts = sorted((r for r in rows if r["budget"] == c), key=lambda r: r["total"])
        if len(pts) < 3:
            continue
        x = np.log([r["total"] for r in pts])
        y = np.array([r["val_bits"] for r in pts])
        a, b, c0 = np.polyfit(x, y, 2)  # a parabola in log N; its vertex is the compute-optimal size
        if a <= 0:
            continue  # no minimum inside the range of sizes tried
        n_opt = math.exp(-b / (2 * a))
        # Tokens at the optimum, interpolated from the runs' actual token counts (C / 6N would be off
        # for small models, whose attention and embedding FLOPs the 6N rule ignores).
        u, v = np.polyfit(x, np.log([r["tokens"] for r in pts]), 1)
        minima.append({"budget": c, "parabola": [a, b, c0], "n_opt": n_opt, "d_opt": math.exp(u * math.log(n_opt) + v),
                       "loss": c0 - b * b / (4 * a)})
    ok = minima
    exponent = float(np.polyfit(np.log([m["budget"] for m in ok]), np.log([m["n_opt"] for m in ok]), 1)[0]) if len(ok) >= 2 else None
    law = _fit_law(rows, "total")
    # Does the law, fitted on runs of at most 6 × 10¹⁵ FLOPs, predict CourseGPT (2 × 10¹⁷)?
    cg = params(8, 512)["total"]
    cg_tokens = 8000 * 256 * 512
    pred = law["E"] + law["A"] / cg ** law["alpha"] + law["B"] / cg_tokens ** law["beta"]
    measured = json.loads((TRAINING / "runs" / "ch14" / "evaluate.json").read_text())["val_bits"] if (TRAINING / "runs" / "ch14" / "evaluate.json").exists() else None
    a, b = law["alpha"], law["beta"]
    G = (a * law["A"] / (b * law["B"])) ** (1 / (a + b))
    out = {"minima": minima, "n_opt_exponent": exponent, "law": law, "G": G,
           "coursegpt": {"params": cg, "tokens": cg_tokens, "predicted": pred, "measured": measured}}
    for m in minima:
        print(f"C = {m['budget']:.2g}: optimal N ≈ {m['n_opt'] / 1e6:.1f} M, D ≈ {m['d_opt'] / 1e6:.0f} M tokens "
              f"({m['d_opt'] / m['n_opt']:.0f} tokens/parameter), loss {m['loss']:.3f}")
    if exponent is not None:
        print(f"N_opt ∝ C^{exponent:.2f}")
    print("L(N, D) = {E:.3f} + {A:.4g} / N^{alpha:.3f} + {B:.4g} / D^{beta:.3f}".format(**law))
    print(f"CourseGPT: predicted {pred:.3f}, measured {measured}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "fit.json").write_text(json.dumps(out, indent=1))


def summary() -> None:
    out = {"runs": results()}
    if (OUT / "fit.json").exists():
        out["fit"] = json.loads((OUT / "fit.json").read_text())
    first = results(FIRST_BATCH)
    if first:
        out["first_sweep"] = {"batch": FIRST_BATCH, "runs": [{k: r[k] for k in ("layers", "width", "budget", "total", "tokens", "val_bits")} for r in first]}
        if (OUT / "fit-b16.json").exists():
            out["first_sweep"]["fit"] = json.loads((OUT / "fit-b16.json").read_text())
    # Loss curves (training bits every 100 steps) against compute, for the frontier plot.
    for r in out["runs"]:
        recs = [json.loads(line) for line in (TRAINING / "runs" / r["name"] / "log.jsonl").read_text().splitlines()]
        per_step = r["batch"] * CONTEXT * r["flops_per_token"]
        r["curve"] = [[rec["step"] * per_step, round(rec["train_bits"], 4)] for rec in recs if "train_bits" in rec]
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

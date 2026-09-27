"""Chapter 15 — sampling and decoding with CourseGPT: the measurements quoted in the chapter.

    uv run lmc ch15 distributions   # next-token distributions for the chapter's offline widgets
    uv run lmc ch15 tradeoff        # likelihood against repetition for many decoding settings (≈ 10 min)
    uv run lmc ch15 fixtures        # parity fixture for the TypeScript samplers
    uv run lmc ch15 summary         # collect into course/content/chapters/15-sampling/data.json

Everything uses runs/<run>/ckpt.pt (CourseGPT by default).
"""

from __future__ import annotations

import json
import math
import time

from .paths import FIXTURES, ROOT, TRAINING
from .sampling import Sampler

OUT = TRAINING / "runs" / "ch15"
CHAPTER = ROOT / "course" / "content" / "chapters" / "15-sampling"

PROMPTS = [
    ("peaked", "Once upon a"),
    ("names", "Once upon a time, there was a little girl named"),
    ("open", "One day, Tom went to the park. He saw a big"),
    ("after", "The end."),
]

SETTINGS = [
    Sampler(temperature=0),
    Sampler(temperature=0.5),
    Sampler(temperature=0.7),
    Sampler(temperature=0.9),
    Sampler(temperature=1.0),
    Sampler(temperature=1.2),
    Sampler(temperature=1.5),
    Sampler(temperature=1.0, top_k=40),
    Sampler(temperature=1.0, top_p=0.9),
    Sampler(temperature=1.0, top_p=0.95),
    Sampler(temperature=1.0, min_p=0.05),
    Sampler(temperature=1.5, min_p=0.1),
    Sampler(temperature=1.5, top_p=0.9),
    Sampler(temperature=0.7, repetition_penalty=1.3),
    Sampler(temperature=0, repetition_penalty=1.3),
]


def load(run: str = "coursegpt"):
    import torch

    from . import tokens
    from .model import GPT, GPTConfig

    dev = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    torch.set_float32_matmul_precision("high")  # TF32 matmuls: generation here is measured, not timed
    ckpt = torch.load(TRAINING / "runs" / run / "ckpt.pt", map_location=dev, weights_only=False)
    c = ckpt["config"]
    tok = tokens.tokeniser()
    model = GPT(GPTConfig(vocab=tok.vocab_size, context=c["context"], width=c["width"], layers=c["layers"], heads=c["heads"]))
    model.load_state_dict(ckpt["model"])
    return model.to(dev).eval(), tok, dev


def distributions(run: str = "coursegpt", top: int = 200) -> None:
    """For each prompt: the top logits with their tokens, and the rest of the vocabulary as a histogram
    of logits (bins of 0.25), enough to apply any temperature or truncation in the browser."""
    import torch

    model, tok, dev = load(run)
    eot = tok.special["<|endoftext|>"]
    out = []
    for key, text in PROMPTS:
        ids = torch.tensor([[eot, *tok.encode(text)]], device=dev)
        with torch.no_grad():
            z = model(ids)[0][0, -1].float().cpu()
        v, i = z.sort(descending=True)
        rest = v[top:]
        lo = math.floor(rest.min().item() * 4) / 4
        bins = torch.bincount(((rest - lo) * 4).long()).tolist()
        out.append({
            "key": key,
            "prompt": text,
            "tokens": [tok.decode([j]) if j != eot else "<|endoftext|>" for j in i[:top].tolist()],
            "logits": [round(x, 3) for x in v[:top].tolist()],
            "tail": {"lo": lo, "width": 0.25, "counts": bins},
        })
        p = z.softmax(-1)
        print(f"{key:>7}: top token {out[-1]['tokens'][0]!r} p={p.max():.3f}, entropy {-(p * p.clamp_min(1e-30).log2()).sum():.2f} bits")
    _write("distributions", out)


def _ngrams(ids: list[int], n: int) -> list[tuple[int, ...]]:
    return [tuple(ids[i : i + n]) for i in range(len(ids) - n + 1)]


def metrics(conts: list[list[int]], logps: list[float]) -> dict:
    """Mean log-probability per token under the model (at T = 1), the share of each continuation's
    4-grams that already occurred earlier in it (repetition), and distinct 4-grams across all of them."""
    rep, total = 0, 0
    everything: list[tuple[int, ...]] = []
    for c in conts:
        grams = _ngrams(c, 4)
        seen: set[tuple[int, ...]] = set()
        for g in grams:
            rep += g in seen
            seen.add(g)
        total += len(grams)
        everything += grams
    return {
        "logp": sum(logps) / len(logps),
        "repetition": rep / max(1, total),
        "distinct4": len(set(everything)) / max(1, len(everything)),
    }


def tradeoff(run: str = "coursegpt", n: int = 200, prompt_len: int = 8, steps: int = 200) -> None:
    """Continue n validation stories from their first `prompt_len` tokens with every setting, and score the
    continuations; the stories' real continuations are the reference."""
    import numpy as np
    import torch

    from . import tokens
    from .sampling import beam_search, generate

    model, tok, dev = load(run)
    eot = tok.special["<|endoftext|>"]
    val = np.asarray(tokens.load("val"))
    starts = np.flatnonzero(val == eot)
    rng = np.random.default_rng(0)
    chosen = [s for s in rng.permutation(starts[:-1]) if val[s + 1 : s + 1 + prompt_len + steps].size == prompt_len + steps
              and eot not in val[s + 1 : s + 1 + prompt_len + steps]][:n]
    prompts = torch.tensor(np.stack([val[s : s + 1 + prompt_len] for s in chosen]).astype(np.int64), device=dev)
    reference = torch.tensor(np.stack([val[s : s + 1 + prompt_len + steps] for s in chosen]).astype(np.int64), device=dev)

    @torch.no_grad()
    def score(full: torch.Tensor) -> list[float]:
        """Mean log P(token | before) at T = 1 over each row's continuation (stopping at an EOT)."""
        with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=dev.type == "cuda"):
            logits, _ = model(full[:, :-1])
        lp = logits.float().log_softmax(-1).gather(-1, full[:, 1:, None])[..., 0][:, prompt_len:]
        out = []
        for row, ids in zip(lp, full[:, 1 + prompt_len :], strict=True):
            stop = (ids == eot).nonzero()
            k = int(stop[0]) + 1 if len(stop) else len(ids)
            out.append(row[:k].mean().item())
        return out

    def continuation(full: torch.Tensor) -> list[list[int]]:
        rows = []
        for ids in full[:, 1 + prompt_len :].tolist():
            rows.append(ids[: ids.index(eot)] if eot in ids else ids)
        return rows

    results = [{"label": "real stories", **metrics(continuation(reference), score(reference))}]
    print(f"{'real stories':<28} logp {results[0]['logp']:.3f}  repetition {results[0]['repetition']:.3f}  distinct {results[0]['distinct4']:.3f}")
    g = torch.Generator(device=dev).manual_seed(0)
    for s in SETTINGS:
        t0 = time.time()
        full = torch.cat([generate(model, prompts[i : i + 50], steps, s, generator=g) for i in range(0, len(prompts), 50)])
        r = {"label": s.label(), **s.__dict__, **metrics(continuation(full), score(full))}
        results.append(r)
        print(f"{r['label']:<28} logp {r['logp']:.3f}  repetition {r['repetition']:.3f}  distinct {r['distinct4']:.3f}  ({time.time() - t0:.0f} s)")
    beams = torch.stack([beam_search(model, p, steps, 4) for p in prompts[:50]])
    r = {"label": "beam search, width 4", **metrics(continuation(beams), score(beams))}
    results.append(r)
    print(f"{r['label']:<28} logp {r['logp']:.3f}  repetition {r['repetition']:.3f}  distinct {r['distinct4']:.3f}")
    examples = {
        "prompt": tok.decode(prompts[0, 1:].tolist()),
        "greedy": tok.decode(continuation(generate(model, prompts[:1], 120, Sampler(temperature=0)))[0]),
        "beam": tok.decode(continuation(beams[:1])[0][:120]),
        "t1": tok.decode(continuation(generate(model, prompts[:1], 120, Sampler(temperature=1.0), generator=g))[0]),
        "t15": tok.decode(continuation(generate(model, prompts[:1], 120, Sampler(temperature=1.5), generator=g))[0]),
        "t15minp": tok.decode(continuation(generate(model, prompts[:1], 120, Sampler(temperature=1.5, min_p=0.1), generator=g))[0]),
    }
    _write("tradeoff", {"n": len(prompts), "steps": steps, "prompt_len": prompt_len, "results": results, "examples": examples})


def fixtures() -> None:
    """Random logits and what each rule keeps, for the TypeScript samplers (packages/core/src/sample)."""
    import torch

    from . import sampling

    torch.manual_seed(0)
    z = torch.randn(6, 50, dtype=torch.float64) * 2
    history = torch.randint(50, (6, 12))
    cases = []
    for s in (Sampler(temperature=1, top_k=5), Sampler(temperature=0.7, top_p=0.8), Sampler(temperature=1.3, min_p=0.1),
              Sampler(temperature=1, repetition_penalty=1.5, top_p=0.9), Sampler(temperature=2, top_k=20, top_p=0.95, min_p=0.02)):
        probs = sampling.prepare(z, history, s).softmax(-1)
        cases.append({"settings": s.__dict__, "probs": probs.tolist()})
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / "ch15_sampling.json").write_text(json.dumps({"logits": z.tolist(), "history": history.tolist(), "cases": cases}) + "\n")
    print(f"wrote {FIXTURES / 'ch15_sampling.json'}")


def _write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1))


def summary() -> None:
    out = {}
    for name in ("distributions", "tradeoff"):
        path = OUT / f"{name}.json"
        if path.exists():
            out[name] = json.loads(path.read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

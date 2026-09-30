"""Chapter 25 — evaluation: a small multiple-choice benchmark built from TinyStories, scored by likelihood, with
confidence intervals; calibration; and what contamination does to a score.

    uv run lmc ch25 benchmark      # every model of the book on "which sentence comes next?" (≈ 5 min)
    uv run lmc ch25 calibration    # CourseGPT's next-token confidence against its accuracy
    uv run lmc ch25 contaminate    # train CourseGPT briefly on the test items, then evaluate again
    uv run lmc ch25 summary        # collect into course/content/chapters/25-evaluation/data.json

An item: the first k sentences of a validation story (k ≥ 2), and four candidates for sentence k + 1 — the true
one and sentences from three other stories. A model picks the candidate with the highest log-probability given
the context, either summed over its tokens or averaged per token.
"""

from __future__ import annotations

import json
import math
import random
import re

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch25"
CHAPTER = ROOT / "course" / "content" / "chapters" / "25-evaluation"
SENT = re.compile(r"(?<=[.!?])\s+")
# The models of the book, smallest first: (run, label).
MODELS = [
    ("scale-1e15-2x128-b64", "2 × 128 (Ch. 17)"),
    ("draft", "2 × 256 draft (Ch. 16)"),
    ("scale-2.5e15-4x256-b64", "4 × 256 (Ch. 17)"),
    ("arch-gpt2", "6 × 384 (Ch. 18)"),
    ("scale-6.2e15-10x640-b64", "10 × 640 (Ch. 17)"),
    ("coursegpt", "CourseGPT 8 × 512"),
]


def items(n: int = 2000, seed: int = 0) -> list[dict]:
    from . import data, tokens

    with open(data.DATA / "TinyStoriesV2-GPT4-valid.txt", encoding="utf-8") as f:
        stories = tokens.stories(f.read())
    rng = random.Random(seed)
    rng.shuffle(stories)
    split = [[s.strip() for s in SENT.split(st) if s.strip()] for st in stories]
    pool = [s for sents in split for s in sents[2:] if 4 <= len(s.split()) <= 30]
    out = []
    for sents in split:
        if len(sents) < 4 or len(" ".join(sents)) > 1500:
            continue
        k = rng.randrange(2, len(sents))
        answer = sents[k]
        if not 4 <= len(answer.split()) <= 30:
            continue
        options = [answer, *rng.sample([p for p in rng.sample(pool, 20) if p != answer], 3)]
        rng.shuffle(options)
        out.append({"context": " ".join(sents[:k]), "options": options, "answer": options.index(answer), "story": " ".join(sents)})
        if len(out) >= n:
            break
    return out


def load(run: str, dev):
    import torch

    from .model import GPT, GPTConfig

    ckpt = torch.load(TRAINING / "runs" / run / "ckpt.pt", map_location=dev, weights_only=False)
    c = ckpt["config"]
    model = GPT(GPTConfig(vocab=8192, context=c["context"], width=c["width"], layers=c["layers"], heads=c["heads"],
                          **{k: c[k] for k in ("norm_type", "mlp_type", "pos", "kv_heads") if k in c})).to(dev)
    model.load_state_dict(ckpt["model"])
    return model.eval()


def option_logprobs(model, tok, its: list[dict], dev) -> list[list[tuple[float, int]]]:
    """For every item and option: (sum of log-probabilities of the option's tokens given the context, token count)."""
    import torch
    import torch.nn.functional as F

    eot = tok.special["<|endoftext|>"]
    out = []
    with torch.no_grad():
        for it in its:
            opts = [tok.encode(" " + o) for o in it["options"]]
            ctx = [eot, *tok.encode(it["context"])][-(model.cfg.context + 1 - max(map(len, opts))) :]  # fit the window
            seqs = [ctx + o for o in opts]
            L = max(map(len, seqs))
            ids = torch.zeros(len(seqs), L, dtype=torch.long)
            for i, s in enumerate(seqs):
                ids[i, : len(s)] = torch.tensor(s)
            ids = ids.to(dev)
            logits, _ = model(ids[:, :-1])
            lp = -F.cross_entropy(logits.float().transpose(1, 2), ids[:, 1:], reduction="none")
            row = []
            for i, s in enumerate(seqs):
                row.append((lp[i, len(ctx) - 1 : len(s) - 1].sum().item(), len(s) - len(ctx)))
            out.append(row)
    return out


def score(lps, its, how: str) -> list[int]:
    """1 for each item the model gets right."""
    right = []
    for row, it in zip(lps, its, strict=True):
        vals = [s if how == "sum" else s / n for s, n in row]
        right.append(int(max(range(len(vals)), key=vals.__getitem__) == it["answer"]))
    return right


def bootstrap(xs: list[int], reps: int = 2000, seed: int = 0) -> tuple[float, float]:
    rng = random.Random(seed)
    n = len(xs)
    means = sorted(sum(xs[rng.randrange(n)] for _ in range(n)) / n for _ in range(reps))
    return means[int(0.025 * reps)], means[int(0.975 * reps)]


def val_bits(model, dev, tokens_: int = 1 << 18) -> float:
    import torch
    import torch.nn.functional as F

    from . import tokens

    val = torch.from_numpy(tokens.load("val")[: tokens_ + 1].astype("int64")).to(dev)
    T = model.cfg.context
    total = count = 0.0
    with torch.no_grad():
        for i in range(0, tokens_ - T, T * 16):
            xs = torch.stack([val[j : j + T] for j in range(i, min(i + T * 16, tokens_ - T), T)])
            ys = torch.stack([val[j + 1 : j + T + 1] for j in range(i, min(i + T * 16, tokens_ - T), T)])
            logits, _ = model(xs)
            total += F.cross_entropy(logits.float().reshape(-1, logits.shape[-1]), ys.reshape(-1), reduction="sum").item()
            count += ys.numel()
    return total / count / math.log(2)


def benchmark(n: int = 1000) -> None:
    import torch

    from . import tokens

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tok = tokens.tokeniser()
    its = items()[:n]
    OUT.mkdir(parents=True, exist_ok=True)
    results, per_item = [], {}
    runs = list(MODELS)
    if (TRAINING / "runs" / "ch20" / "lora16.pt").exists():
        runs.append(("instruct", "CourseGPT, instruction-tuned (Ch. 20)"))
    for run, label in runs:
        if run == "instruct":
            model = load("coursegpt", dev)
            model.load_state_dict(torch.load(TRAINING / "runs" / "ch20" / "lora16.pt", map_location=dev))
        elif (TRAINING / "runs" / run / "ckpt.pt").exists():
            model = load(run, dev)
        else:
            print(f"skipping {run}: no checkpoint")
            continue
        lps = option_logprobs(model, tok, its, dev)
        r_sum, r_mean = score(lps, its, "sum"), score(lps, its, "mean")
        # The model's probability for the true answer, among the four (from summed log-probabilities).
        conf = []
        for row, it in zip(lps, its, strict=True):
            m = max(s for s, _ in row)
            z = [math.exp(s - m) for s, _ in row]
            conf.append([max(z) / sum(z), int(max(range(4), key=lambda i: row[i][0]) == it["answer"])])
        res = {"run": run, "label": label, "params": sum(p.numel() for p in model.parameters()), "val_bits": val_bits(model, dev),
               "acc_sum": sum(r_sum) / n, "ci_sum": bootstrap(r_sum), "acc_mean": sum(r_mean) / n, "ci_mean": bootstrap(r_mean)}
        results.append(res)
        per_item[run] = {"sum": r_sum, "conf": conf}
        print(f"{label}: {res['val_bits']:.3f} bits/token, accuracy {res['acc_sum']:.1%} (sum) {res['acc_mean']:.1%} (mean)")
    # Paired comparison of the two best models: bootstrap the difference over the same items.
    a, b = per_item.get("coursegpt"), per_item.get("scale-6.2e15-10x640-b64")
    paired = None
    if a and b:
        diffs = [x - y for x, y in zip(a["sum"], b["sum"], strict=True)]
        paired = {"a": "coursegpt", "b": "scale-6.2e15-10x640-b64", "diff": sum(diffs) / n, "ci": bootstrap(diffs)}
    ex = [{k: it[k] for k in ("context", "options", "answer")} for it in its[:4]]
    (OUT / "benchmark.json").write_text(json.dumps({"n": n, "results": results, "paired": paired, "examples": ex,
                                                    "conf": per_item.get("coursegpt", {}).get("conf")}))


def calibration(tokens_: int = 1 << 18, bins: int = 10) -> None:
    """Reliability of CourseGPT's top-1 next-token prediction: bin by the probability of its top token, and
    compare with how often that token is right."""
    import torch

    from . import tokens

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load("coursegpt", dev)
    val = torch.from_numpy(tokens.load("val")[: tokens_ + 1].astype("int64")).to(dev)
    T = model.cfg.context
    conf, right = [], []
    with torch.no_grad():
        for i in range(0, tokens_ - T, T * 16):
            starts = range(i, min(i + T * 16, tokens_ - T), T)
            xs = torch.stack([val[j : j + T] for j in starts])
            ys = torch.stack([val[j + 1 : j + T + 1] for j in starts])
            p = model(xs)[0].float().softmax(-1)
            top, arg = p.max(-1)
            conf.append(top.flatten())
            right.append((arg == ys).flatten().float())
    conf, right = torch.cat(conf), torch.cat(right)
    rows = []
    for b in range(bins):
        m = (conf >= b / bins) & (conf < (b + 1) / bins if b < bins - 1 else conf <= 1)
        if m.sum() > 0:
            rows.append([b / bins, (b + 1) / bins, conf[m].mean().item(), right[m].mean().item(), int(m.sum())])
    ece = sum(r[4] * abs(r[2] - r[3]) for r in rows) / len(conf)
    print(f"top-1 accuracy {right.mean():.1%}, mean confidence {conf.mean():.1%}, ECE {ece:.4f}")
    (OUT / "calibration.json").write_text(json.dumps({"bins": rows, "ece": ece, "accuracy": right.mean().item(),
                                                      "confidence": conf.mean().item(), "tokens": len(conf)}))


def contaminate(steps: int = 60, lr: float = 1e-4) -> None:
    """Train CourseGPT on the full stories of the first 1,000 items (as if the test set had leaked into the
    training data), then evaluate on those items and on 1,000 new ones."""
    import torch

    from . import tokens

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tok = tokens.tokeniser()
    its = items()
    test, fresh = its[:1000], its[1000:2000]
    model = load("coursegpt", dev)
    before = {"test": sum(score(option_logprobs(model, tok, test, dev), test, "sum")) / len(test),
              "fresh": sum(score(option_logprobs(model, tok, fresh, dev), fresh, "sum")) / len(fresh)}
    model.train()
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.0)
    eot = tok.special["<|endoftext|>"]
    seqs = [[eot, *tok.encode(it["story"]), eot][:512] for it in test]
    rng = random.Random(0)
    curve = []
    for step in range(1, steps + 1):
        chunk = rng.sample(seqs, 16)
        L = max(map(len, chunk))
        x = torch.zeros(16, L - 1, dtype=torch.long)
        y = torch.full((16, L - 1), -100, dtype=torch.long)
        for i, s in enumerate(chunk):
            x[i, : len(s) - 1] = torch.tensor(s[:-1])
            y[i, : len(s) - 1] = torch.tensor(s[1:])
        _, loss = model(x.to(dev), y.to(dev))
        loss.backward()
        opt.step()
        opt.zero_grad(set_to_none=True)
        if step % 20 == 0:
            model.eval()
            t = sum(score(option_logprobs(model, tok, test, dev), test, "sum")) / len(test)
            f = sum(score(option_logprobs(model, tok, fresh, dev), fresh, "sum")) / len(fresh)
            model.train()
            curve.append([step, t, f])
            print(f"  step {step} (≈ {step * 16 / len(test):.1f} passes over the test stories): test {t:.1%}, fresh {f:.1%}")
    (OUT / "contaminate.json").write_text(json.dumps({"before": before, "curve": curve, "steps": steps, "lr": lr}))


def summary() -> None:
    out = {}
    for name in ("benchmark", "calibration", "contaminate"):
        if (OUT / f"{name}.json").exists():
            out[name] = json.loads((OUT / f"{name}.json").read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

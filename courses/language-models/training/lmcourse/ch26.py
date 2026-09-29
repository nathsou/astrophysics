"""Chapter 26 — interpretability: looking inside CourseGPT.

    uv run lmc ch26 lens       # the logit lens: what each layer would predict
    uv run lmc ch26 heads      # previous-token and induction scores for every attention head
    uv run lmc ch26 probe      # a linear probe for a name's gender, at every layer
    uv run lmc ch26 sae        # a top-k sparse autoencoder on the middle of the residual stream (≈ 10 min)
    uv run lmc ch26 summary    # collect into course/content/chapters/26-interpretability/data.json
"""

from __future__ import annotations

import json
import math
import random
import re
from collections import Counter, defaultdict

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch26"
CHAPTER = ROOT / "course" / "content" / "chapters" / "26-interpretability"
SAE_LAYER = 4  # the residual stream after block 4 of 8
LENS_PROMPTS = [
    "Once upon a time, there was a little girl named Lily. She loved to play with her ball in the park. One day, Lily",
    "Tom and his dog went to the beach. They played in the sand and swam in the water. At the end of the day, Tom was very",
]


def _setup():
    import torch

    from . import tokens
    from .ch25 import load

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    OUT.mkdir(parents=True, exist_ok=True)
    return load("coursegpt", dev), tokens.tokeniser(), dev


def residuals(model, ids) -> list:
    """The residual stream before the first block and after each block: layers + 1 tensors of (B, T, C)."""
    T = ids.shape[1]
    x = model.tok[ids] + model.pos[:T]
    out = [x]
    for block in model.blocks:
        x = block(x)
        out.append(x)
    return out


def run_from(model, x, layer: int):
    """Logits from the residual stream `x` taken after block `layer` (the rest of the network applied)."""
    for block in model.blocks[layer:]:
        x = block(x)
    return model.lnf(x) @ model.tok.t()


def attention(model, x, layer: int):
    """Attention probabilities of every head of block `layer`, given its input residual stream: (B, H, T, T)."""
    import torch

    b = model.blocks[layer]
    B, T, C = x.shape
    h = model.cfg.heads
    d = C // h
    a = b.ln1(x)
    q = (a @ b.attn["q"]).view(B, T, h, d).transpose(1, 2)
    k = (a @ b.attn["k"]).view(B, T, h, d).transpose(1, 2)
    s = (q @ k.transpose(-1, -2)) / math.sqrt(d)
    s = s.masked_fill(torch.triu(torch.ones(T, T, dtype=torch.bool, device=x.device), 1), float("-inf"))
    return s.softmax(-1)


def _val(n: int, dev):
    import torch

    from . import tokens

    return torch.from_numpy(tokens.load("val")[: n + 1].astype("int64")).to(dev)


def lens() -> None:
    import torch

    model, tok, dev = _setup()
    OUT.mkdir(parents=True, exist_ok=True)
    eot = tok.special["<|endoftext|>"]
    prompts = []
    with torch.no_grad():
        for text in LENS_PROMPTS:
            ids = torch.tensor([[eot, *tok.encode(text)]], device=dev)
            rs = residuals(model, ids)
            grid = []
            for r in rs:
                p = (model.lnf(r) @ model.tok.t()).float().softmax(-1)[0]
                top = p.topk(3, -1)
                grid.append([[[tok.decode([int(i)]), round(float(v), 4)] for v, i in zip(tv, ti, strict=True)] for tv, ti in zip(top.values, top.indices, strict=True)])
            prompts.append({"tokens": [tok.decode([int(i)]) for i in ids[0]], "lens": grid})
        # Averages over validation text: agreement of each layer's top-1 with the final layer's, and the KL
        # divergence from the final distribution, in bits.
        val = _val(1 << 16, dev)
        T = 512
        xs = torch.stack([val[i : i + T] for i in range(0, (1 << 16) - T, T)])
        agree, kl, acc = [], [], []
        for i in range(0, len(xs), 16):
            rs = residuals(model, xs[i : i + 16])
            final = (model.lnf(rs[-1]) @ model.tok.t()).float().log_softmax(-1)
            row_a, row_k, row_c = [], [], []
            for r in rs:
                lp = (model.lnf(r) @ model.tok.t()).float().log_softmax(-1)
                row_a.append((lp.argmax(-1) == final.argmax(-1)).float().mean().item())
                row_k.append((final.exp() * (final - lp)).sum(-1).mean().item() / math.log(2))
                tgt = torch.stack([val[j + 1 : j + T + 1] for j in range(i * T, (i + len(r)) * T, T)])
                row_c.append((lp.argmax(-1) == tgt).float().mean().item())
            agree.append(row_a)
            kl.append(row_k)
            acc.append(row_c)
    mean = lambda rows: [sum(c) / len(c) for c in zip(*rows, strict=True)]
    (OUT / "lens.json").write_text(json.dumps({"prompts": prompts, "agree": mean(agree), "kl_bits": mean(kl), "top1": mean(acc)}, ensure_ascii=False))
    print("agreement with the final layer:", [round(v, 3) for v in mean(agree)])


def heads(T: int = 128, batch: int = 32) -> None:
    """Scores on sequences of random tokens repeated twice: attention from each position of the second copy to
    the token *after* its earlier occurrence (induction), and to the previous position (previous-token)."""
    import torch
    import torch.nn.functional as F

    model, tok, dev = _setup()
    g = torch.Generator(device="cpu").manual_seed(0)
    eot = tok.special["<|endoftext|>"]
    rand = torch.randint(300, 8000, (batch, T), generator=g)
    ids = torch.cat([torch.full((batch, 1), eot), rand, rand], 1).to(dev)
    L, H = model.cfg.layers, model.cfg.heads
    induction = [[0.0] * H for _ in range(L)]
    previous = [[0.0] * H for _ in range(L)]
    with torch.no_grad():
        rs = residuals(model, ids)
        for layer in range(L):
            a = attention(model, rs[layer], layer)  # (B, H, 2T+1, 2T+1)
            second = torch.arange(T + 1, 2 * T + 1, device=dev)
            ind = a[:, :, second, second - T + 1].mean((0, 2))
            prev = a[:, :, torch.arange(2, 2 * T + 1, device=dev), torch.arange(1, 2 * T, device=dev)].mean((0, 2))
            for hd in range(H):
                induction[layer][hd] = round(ind[hd].item(), 4)
                previous[layer][hd] = round(prev[hd].item(), 4)
        # Loss per position: high on the first copy (random tokens), low on the second if the model copies.
        logits = model(ids[:, :-1])[0].float()
        loss = F.cross_entropy(logits.transpose(1, 2), ids[:, 1:], reduction="none").mean(0) / math.log(2)
        # Attention patterns of the strongest heads on a short repeated sentence.
        text = " The old owl sat on a red branch and sang to the moon."
        s = tok.encode(text)
        ex = torch.tensor([[eot, *s, *s]], device=dev)
        rs = residuals(model, ex)
        best_ind = max(((li, hd) for li in range(L) for hd in range(H)), key=lambda p: induction[p[0]][p[1]])
        best_prev = max(((li, hd) for li in range(L) for hd in range(H)), key=lambda p: previous[p[0]][p[1]])
        patterns = {name: {"layer": li, "head": hd, "attn": [[round(v, 3) for v in row] for row in attention(model, rs[li], li)[0, hd].tolist()]}
                    for name, (li, hd) in (("induction", best_ind), ("previous", best_prev))}
    (OUT / "heads.json").write_text(json.dumps({"induction": induction, "previous": previous, "T": T,
                                                "loss": [round(v, 3) for v in loss.tolist()],
                                                "example": {"tokens": [tok.decode([int(i)]) for i in ex[0]], **patterns}}, ensure_ascii=False))
    print("best induction head", best_ind, induction[best_ind[0]][best_ind[1]], "best previous-token head", best_prev)


def _names(min_count: int = 8, purity: float = 0.9) -> dict[str, int]:
    """Names from "named X" in the training stories, labelled 1 (she) or 0 (he) by the pronoun that follows."""
    from . import data, tokens

    with open(data.path("tinystories"), encoding="utf-8") as f:
        stories = tokens.stories(f.read(300_000_000))
    counts: dict[str, Counter] = defaultdict(Counter)
    pat = re.compile(r"named ([A-Z][a-z]+)\b(.{0,160})", re.DOTALL)
    for s in stories:
        for m in pat.finditer(s):
            p = re.search(r"\b(she|he|her|his|him)\b", m.group(2), re.IGNORECASE)
            if p:
                counts[m.group(1)]["f" if p.group(1).lower() in ("she", "her") else "m"] += 1
    out = {}
    for name, c in counts.items():
        n = c["f"] + c["m"]
        if n >= min_count and max(c["f"], c["m"]) / n >= purity:
            out[name] = int(c["f"] > c["m"])
    return out


def probe(epochs: int = 300) -> None:
    """Logistic regression on the residual stream, trained on 70% of names and tested on the rest, at every
    layer, for two positions: the name's last token in "One day, <name>", and the final token of
    "One day, <name> went to the park. Then" — where the gender must have been moved from the name by attention.
    Each is repeated with shuffled labels, as a control."""
    import torch

    model, tok, dev = _setup()
    names = _names()
    items = sorted(names.items())
    random.Random(0).shuffle(items)
    eot = tok.special["<|endoftext|>"]
    templates = {"name": "One day, {}", "later": "One day, {} went to the park. Then"}
    feats = {key: [[] for _ in range(model.cfg.layers + 1)] for key in templates}
    with torch.no_grad():
        for name, _ in items:
            for key, tpl in templates.items():
                ids = torch.tensor([[eot, *tok.encode(tpl.format(name))]], device=dev)
                for layer, r in enumerate(residuals(model, ids)):
                    feats[key][layer].append(r[0, -1].float())
    y = torch.tensor([lab for _, lab in items], dtype=torch.float32, device=dev)
    cut = int(0.7 * len(items))
    shuffled = y[torch.randperm(len(y), generator=torch.Generator().manual_seed(1)).to(dev)]

    def fit(X, labels) -> float:
        X = (X - X[:cut].mean(0)) / (X[:cut].std(0) + 1e-5)
        w = torch.zeros(X.shape[1], device=dev, requires_grad=True)
        b = torch.zeros((), device=dev, requires_grad=True)
        opt = torch.optim.Adam([w, b], lr=0.01)
        for _ in range(epochs):
            loss = torch.nn.functional.binary_cross_entropy_with_logits(X[:cut] @ w + b, labels[:cut]) + 1e-2 * (w * w).sum()
            loss.backward()
            opt.step()
            opt.zero_grad()
        with torch.no_grad():
            return (((X[cut:] @ w + b) > 0).float() == labels[cut:]).float().mean().item()

    out = {"names": len(items), "test": len(items) - cut, "examples": [n for n, _ in items[:12]],
           "majority": max(y[cut:].mean().item(), 1 - y[cut:].mean().item()), "templates": templates}
    for key in templates:
        out[key] = {"accuracy": [fit(torch.stack(f), y) for f in feats[key]], "control": [fit(torch.stack(f), shuffled) for f in feats[key]]}
        print(key, "probe accuracy by layer:", [round(a, 3) for a in out[key]["accuracy"]], "control:", [round(a, 3) for a in out[key]["control"]])
    (OUT / "probe.json").write_text(json.dumps(out))


class TopKSae:
    """x → f = TopK(ReLU(W_enc (x − b_dec) + b_enc)) → x̂ = W_dec f + b_dec, with unit-norm decoder rows."""

    def __init__(self, d: int, m: int, k: int, dev) -> None:
        import torch

        g = torch.Generator().manual_seed(0)
        self.k = k
        self.W_dec = (torch.randn(m, d, generator=g) / math.sqrt(d)).to(dev)
        self.W_dec /= self.W_dec.norm(dim=1, keepdim=True)
        self.W_enc = self.W_dec.t().clone()
        self.b_enc = torch.zeros(m, device=dev)
        self.b_dec = torch.zeros(d, device=dev)
        self.params = [self.W_enc, self.b_enc, self.W_dec, self.b_dec]
        for p in self.params:
            p.requires_grad_(True)

    def encode(self, x):
        import torch

        pre = torch.relu((x - self.b_dec) @ self.W_enc + self.b_enc)
        top = pre.topk(self.k, -1)
        return torch.zeros_like(pre).scatter(-1, top.indices, top.values)

    def decode(self, f):
        return f @ self.W_dec + self.b_dec


def sae(steps: int = 4000, m: int = 4096, k: int = 32, lr: float = 4e-4, eval_tokens: int = 1 << 20, B: int = 16) -> None:
    import torch
    import torch.nn.functional as F

    from . import tokens

    model, tok, dev = _setup()
    train = torch.from_numpy(tokens.load("train")[: 1 << 27].astype("int64"))
    T = 512
    rng = torch.Generator().manual_seed(0)
    C = model.cfg.width
    sae_ = TopKSae(C, m, k, dev)
    opt = torch.optim.Adam(sae_.params, lr=lr, betas=(0.9, 0.999))
    with torch.no_grad():  # scale activations so that their mean squared norm is C
        starts = torch.randint(0, len(train) - T - 1, (B,), generator=rng)
        x = residuals(model, torch.stack([train[s : s + T] for s in starts]).to(dev))[SAE_LAYER][:, 1:].float().reshape(-1, C)
        scale = math.sqrt(C) / x.norm(dim=1).mean().item()
    fired = torch.zeros(m, device=dev)
    curve = []
    for step in range(1, steps + 1):
        with torch.no_grad():
            starts = torch.randint(0, len(train) - T - 1, (B,), generator=rng)
            ids = torch.stack([train[s : s + T] for s in starts]).to(dev)
            # Position 0 of every window is left out: its residual stream is unusually large (an "attention sink").
            x = residuals(model, ids)[SAE_LAYER][:, 1:].float().reshape(-1, C) * scale
        f = sae_.encode(x)
        xh = sae_.decode(f)
        loss = ((xh - x) ** 2).sum(-1).mean() / (x - x.mean(0)).pow(2).sum(-1).mean()
        loss.backward()
        with torch.no_grad():  # keep decoder rows unit-norm: remove the gradient's radial part, then renormalise
            g = sae_.W_dec.grad
            g -= (g * sae_.W_dec).sum(1, keepdim=True) * sae_.W_dec
        opt.step()
        opt.zero_grad(set_to_none=True)
        with torch.no_grad():
            sae_.W_dec /= sae_.W_dec.norm(dim=1, keepdim=True)
            fired += (f > 0).float().sum(0)
        for gr in opt.param_groups:
            gr["lr"] = lr * min(1.0, (steps - step) / (0.2 * steps) + 0.0)
        if step % 250 == 0:
            curve.append([step, round(loss.item(), 4)])
            print(f"  SAE step {step}: fraction of variance unexplained {loss.item():.3f}, dead {(fired == 0).float().mean().item():.1%}")
            fired.zero_()
    # Evaluation on validation text: reconstruction, and the loss when the model runs on the reconstruction.
    val = _val(eval_tokens, dev)
    counts = torch.zeros(m, device=dev)
    ce = {"clean": 0.0, "sae": 0.0, "mean": 0.0}
    fvu_num = fvu_den = 0.0
    n_tok = 0
    mean_x = None
    acts_store = []
    with torch.no_grad():
        for i in range(0, eval_tokens - T, T * 8):
            idx = list(range(i, min(i + T * 8, eval_tokens - T), T))
            ids = torch.stack([val[j : j + T] for j in idx])
            ys = torch.stack([val[j + 1 : j + T + 1] for j in idx])
            rs = residuals(model, ids)
            x = rs[SAE_LAYER].float() * scale
            f = sae_.encode(x.reshape(-1, C))
            xh = sae_.decode(f).reshape(x.shape)
            mean_x = x.mean((0, 1)) if mean_x is None else mean_x
            fvu_num += ((xh - x) ** 2).sum().item()
            fvu_den += ((x - x.mean((0, 1))) ** 2).sum().item()
            counts += (f > 0).float().sum(0)
            n_tok += f.shape[0]
            for name, h in (("clean", x), ("sae", xh), ("mean", mean_x.expand_as(x))):
                logits = run_from(model, h / scale, SAE_LAYER).float()
                ce[name] += F.cross_entropy(logits.reshape(-1, logits.shape[-1]), ys.reshape(-1), reduction="sum").item()
            acts_store.append(f.reshape(len(idx), T, m)[:, 1:].amax(1))  # each feature's peak in each window
    density = (counts / n_tok).tolist()
    for key in ce:
        ce[key] /= n_tok * math.log(2)
    recovered = (ce["mean"] - ce["sae"]) / (ce["mean"] - ce["clean"])
    print(f"FVU {fvu_num / fvu_den:.3f}, bits/token clean {ce['clean']:.3f}, with SAE {ce['sae']:.3f}, mean-ablated {ce['mean']:.3f}; recovered {recovered:.1%}")
    # Feature cards: 40 features chosen at random among those that fire on 0.01%–3% of tokens.
    live = [j for j in range(m) if 1e-4 <= density[j] <= 3e-2]
    chosen = sorted(random.Random(0).sample(live, min(40, len(live))))
    cards = []
    with torch.no_grad():
        # Top-activating windows for each chosen feature (the best 8, one example per window).
        peaks = torch.cat(acts_store)  # (windows, m)
        for j in chosen:
            examples = []
            vals, wins = peaks[:, j].topk(8)
            for v, w in zip(vals.tolist(), wins.tolist(), strict=True):
                if v <= 0:
                    continue
                start = w * T
                ids = val[start : start + T][None]
                x = residuals(model, ids)[SAE_LAYER].float() * scale
                a = sae_.encode(x[0])[:, j]
                a[0] = 0
                p = int(a.argmax())
                lo, hi = max(0, p - 14), min(T, p + 4)
                examples.append({"tokens": [tok.decode([int(t)]) for t in ids[0, lo:hi]], "acts": [round(v, 2) for v in a[lo:hi].tolist()]})
            promoted = (sae_.W_dec[j] @ model.tok.t().float()).topk(6).indices.tolist()
            cards.append({"id": j, "density": density[j], "examples": examples, "promotes": [tok.decode([t]) for t in promoted]})
    hist = Counter(min(6, max(0, int(-math.log10(d)))) if d > 0 else 7 for d in density)
    (OUT / "sae.json").write_text(json.dumps({
        "layer": SAE_LAYER, "m": m, "k": k, "steps": steps, "curve": curve, "fvu": fvu_num / fvu_den, "bits": ce, "recovered": recovered,
        "dead": sum(d == 0 for d in density) / m, "density_hist": {str(key): v for key, v in sorted(hist.items())}, "features": cards,
    }, ensure_ascii=False))


def summary() -> None:
    out = {}
    for name in ("lens", "heads", "probe", "sae"):
        if (OUT / f"{name}.json").exists():
            out[name] = json.loads((OUT / f"{name}.json").read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

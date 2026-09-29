"""Chapter 21 — learning from preferences: a reward model, best-of-n, and DPO, on the instruction-tuned
CourseGPT of Chapter 20.

    uv run lmc ch21 pairs      # the SFT model writes two stories per instruction; the better one is "chosen" (≈ 15 min)
    uv run lmc ch21 reward     # a Bradley–Terry reward model, and its accuracy on held-out pairs
    uv run lmc ch21 bestofn    # best-of-n sampling, with the reward model and with the true score
    uv run lmc ch21 dpo        # Direct Preference Optimisation from the SFT model, at two values of β
    uv run lmc ch21 summary    # collect into course/content/chapters/21-preference-learning/data.json

The preference is known exactly, which real preferences are not: of two stories written for the same
instruction, the one that uses more of the required name and words is better. That lets us measure what
each method learns, and what it gives up in fluency (bits per token of its stories under the original
CourseGPT) to get there.
"""

from __future__ import annotations

import json
import math
import random
import re

from .ch20 import OUT as CH20
from .ch20 import _model, examples, instruction
from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch21"
CHAPTER = ROOT / "course" / "content" / "chapters" / "21-preference-learning"


def score(text: str, ex: dict) -> int:
    """How many of the four constraints (the name and three words) a story satisfies."""
    return (ex["name"] in text) + sum(bool(re.search(rf"\b{w}\b", text, re.IGNORECASE)) for w in ex["words"])


def _dev():
    import torch

    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _sft(dev):
    import torch

    model = _model(dev)
    model.load_state_dict(torch.load(CH20 / "lora16.pt", map_location=dev))
    return model


def _generate(model, tok, instrs: list[dict], per: int, temperature: float, seed: int, batch: int = 64, steps: int = 220) -> list[list[str]]:
    """`per` stories for each instruction."""
    import torch

    from .sampling import Sampler, generate

    dev = next(model.parameters()).device
    eot = tok.special["<|endoftext|>"]
    g = torch.Generator(device=dev).manual_seed(seed)
    prompts = [[eot, *tok.encode(instruction(e["name"], e["words"]))] for e in instrs for _ in range(per)]
    out = []
    model.eval()
    for i in range(0, len(prompts), batch):
        chunk = prompts[i : i + batch]
        L = max(map(len, chunk))
        # Left-pad with EOT so every prompt ends at the same position (a lone extra EOT is harmless context).
        ids = torch.tensor([[eot] * (L - len(p)) + p for p in chunk], device=dev)
        with torch.autocast(dev.type, dtype=torch.bfloat16, enabled=dev.type == "cuda"):
            res = generate(model, ids, steps, Sampler(temperature=temperature), generator=g)[:, L:].tolist()
        for r in res:
            out.append(tok.decode(r[: r.index(eot)] if eot in r else r))
    return [out[i * per : (i + 1) * per] for i in range(len(instrs))]


def pairs(n: int = 6000) -> None:
    from . import tokens

    dev = _dev()
    tok = tokens.tokeniser()
    model = _sft(dev)
    instrs = examples("train", 60_000)[40_000 : 40_000 + n]  # instructions the SFT model was not trained on
    stories = _generate(model, tok, instrs, 2, 1.0, seed=0)
    out, ties = [], 0
    for ex, (a, b) in zip(instrs, stories, strict=True):
        sa, sb = score(a, ex), score(b, ex)
        if sa == sb:
            ties += 1
            continue
        chosen, rejected = (a, b) if sa > sb else (b, a)
        out.append({"name": ex["name"], "words": ex["words"], "chosen": chosen, "rejected": rejected, "scores": [max(sa, sb), min(sa, sb)]})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "pairs.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"{len(out):,} pairs from {n:,} instructions ({ties:,} ties discarded)")


def _load_pairs():
    ps = json.loads((OUT / "pairs.json").read_text())
    return ps[:-400], ps[-400:]


def _tokens(tok, ex: dict, story: str) -> tuple[list[int], int]:
    eot = tok.special["<|endoftext|>"]
    prompt = [eot, *tok.encode(instruction(ex["name"], ex["words"]))]
    return (prompt + tok.encode(story) + [eot])[:512], len(prompt)


class RewardModel:
    """CourseGPT's body with a scalar head on the final hidden state of the last token (the closing EOT)."""

    def __init__(self, dev):
        import torch

        self.body = _sft(dev)
        self.head = torch.nn.Linear(self.body.cfg.width, 1).to(dev)

    def parameters(self):
        return [*self.body.parameters(), *self.head.parameters()]

    def __call__(self, seqs: list[list[int]]):
        import torch

        dev = self.head.weight.device
        L = max(map(len, seqs))
        ids = torch.zeros(len(seqs), L, dtype=torch.long, device=dev)
        for i, s in enumerate(seqs):
            ids[i, : len(s)] = torch.tensor(s)
        h = self.body.features(ids)
        last = torch.tensor([len(s) - 1 for s in seqs], device=dev)
        return self.head(h[torch.arange(len(seqs), device=dev), last].float())[:, 0]


def reward(epochs: int = 1, batch: int = 16, lr: float = 1e-5) -> None:
    import torch
    import torch.nn.functional as F

    from . import tokens

    dev = _dev()
    tok = tokens.tokeniser()
    train, test = _load_pairs()
    rm = RewardModel(dev)
    opt = torch.optim.AdamW(rm.parameters(), lr=lr, weight_decay=0.0)
    enc = lambda p, key: _tokens(tok, p, p[key])[0]

    def accuracy() -> float:
        rm.body.eval()
        right = 0
        with torch.no_grad():
            for i in range(0, len(test), 32):
                chunk = test[i : i + 32]
                rc, rr = rm([enc(p, "chosen") for p in chunk]), rm([enc(p, "rejected") for p in chunk])
                right += (rc > rr).sum().item()
        rm.body.train()
        return right / len(test)

    curve = [[0, accuracy()]]
    rng = random.Random(0)
    step = 0
    for _ in range(epochs):
        rng.shuffle(train)
        for i in range(0, len(train) - batch + 1, batch):
            chunk = train[i : i + batch]
            rc, rr = rm([enc(p, "chosen") for p in chunk]), rm([enc(p, "rejected") for p in chunk])
            loss = -F.logsigmoid(rc - rr).mean()  # Bradley–Terry: P(chosen ≻ rejected) = σ(r_c − r_r)
            loss.backward()
            opt.step()
            opt.zero_grad(set_to_none=True)
            step += 1
            if step % 50 == 0:
                curve.append([step, accuracy()])
                print(f"  reward model step {step}: held-out accuracy {curve[-1][1]:.1%}")
    torch.save({"body": rm.body.state_dict(), "head": rm.head.state_dict()}, OUT / "reward.pt")
    (OUT / "reward.json").write_text(json.dumps({"curve": curve, "pairs": len(train)}))


def _evaluate(model, tok, n: int = 200, seed: int = 0) -> dict:
    """Constraint satisfaction on held-out instructions, and fluency: bits per token of the generated stories
    under the original CourseGPT (lower is more natural)."""
    import torch
    import torch.nn.functional as F

    dev = next(model.parameters()).device
    tests = examples("val", n, seed=1)
    stories = [s[0] for s in _generate(model, tok, tests, 1, 0.7, seed=seed)]
    scores = [score(s, e) for s, e in zip(stories, tests, strict=True)]
    base = _model(dev).eval()
    eot = tok.special["<|endoftext|>"]
    bits = count = 0.0
    with torch.no_grad():
        for s in stories:
            ids = torch.tensor([[eot, *tok.encode(s)[:511]]], device=dev)
            if ids.shape[1] < 2:
                continue
            logits, _ = base(ids[:, :-1])
            bits += F.cross_entropy(logits[0].float(), ids[0, 1:], reduction="sum").item() / math.log(2)
            count += ids.shape[1] - 1
    return {"all": sum(sc == 4 for sc in scores) / n, "mean_score": sum(scores) / n, "fluency_bits": bits / max(count, 1),
            "samples": [{"instruction": instruction(e["name"], e["words"]).strip(), "story": s} for e, s in list(zip(tests, stories, strict=True))[:3]]}


def bestofn(n: int = 200, ks: tuple[int, ...] = (1, 2, 4, 8, 16)) -> None:
    import torch

    from . import tokens

    dev = _dev()
    tok = tokens.tokeniser()
    model = _sft(dev)
    rm = RewardModel(dev)
    state = torch.load(OUT / "reward.pt", map_location=dev)
    rm.body.load_state_dict(state["body"])
    rm.head.load_state_dict(state["head"])
    rm.body.eval()
    tests = examples("val", n, seed=1)
    samples = _generate(model, tok, tests, max(ks), 1.0, seed=3)
    with torch.no_grad():
        rewards = [[rm([_tokens(tok, e, s)[0]]).item() for s in group] for e, group in zip(tests, samples, strict=True)]
    out = {"reward_model": [], "oracle": []}
    for k in ks:
        by_rm = by_true = 0
        for e, group, rs in zip(tests, samples, rewards, strict=True):
            pick = max(range(k), key=lambda i: rs[i])
            by_rm += score(group[pick], e) == 4
            by_true += max(score(s, e) for s in group[:k]) == 4
        out["reward_model"].append([k, by_rm / n])
        out["oracle"].append([k, by_true / n])
        print(f"best of {k}: reward model {by_rm / n:.1%}, true score {by_true / n:.1%}")
    (OUT / "bestofn.json").write_text(json.dumps(out))


def dpo(betas: tuple[float, ...] = (0.1, 0.5), steps: int = 400, batch: int = 16, lr: float = 5e-6) -> None:
    import torch
    import torch.nn.functional as F

    from . import tokens

    dev = _dev()
    tok = tokens.tokeniser()
    train, _ = _load_pairs()
    results = {"sft": _evaluate(_sft(dev), tok)}
    print("SFT:", {k: v for k, v in results["sft"].items() if k != "samples"})

    def logp(model, seqs):
        """Sum of log-probabilities of each sequence's response tokens."""
        L = max(len(s) for s, _ in seqs)
        ids = torch.zeros(len(seqs), L, dtype=torch.long, device=dev)
        mask = torch.zeros(len(seqs), L - 1, device=dev)
        for i, (s, start) in enumerate(seqs):
            ids[i, : len(s)] = torch.tensor(s)
            mask[i, start - 1 : len(s) - 1] = 1
        logits, _ = model(ids[:, :-1])
        lp = -F.cross_entropy(logits.float().transpose(1, 2), ids[:, 1:], reduction="none")
        return (lp * mask).sum(1)

    for beta in betas:
        policy, ref = _sft(dev), _sft(dev)
        ref.eval()
        opt = torch.optim.AdamW(policy.parameters(), lr=lr, weight_decay=0.0)
        rng = random.Random(0)
        curve = []
        for step in range(1, steps + 1):
            chunk = rng.sample(train, batch)
            c = [_tokens(tok, p, p["chosen"]) for p in chunk]
            r = [_tokens(tok, p, p["rejected"]) for p in chunk]
            with torch.no_grad():
                ref_c, ref_r = logp(ref, c), logp(ref, r)
            pol_c, pol_r = logp(policy, c), logp(policy, r)
            # DPO: the policy's implicit reward is β·log(π/π_ref); raise it for chosen, lower it for rejected.
            margin = beta * ((pol_c - ref_c) - (pol_r - ref_r))
            loss = -F.logsigmoid(margin).mean()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(policy.parameters(), 1.0)
            opt.step()
            opt.zero_grad(set_to_none=True)
            if step % 25 == 0:
                curve.append([step, round(loss.item(), 4), round((margin > 0).float().mean().item(), 3)])
        res = _evaluate(policy, tok)
        res["curve"] = curve
        results[f"dpo-{beta:g}"] = res
        print(f"DPO β = {beta}:", {k: v for k, v in res.items() if k not in ("samples", "curve")})
    (OUT / "dpo.json").write_text(json.dumps(results, ensure_ascii=False))


def summary() -> None:
    out = {}
    for name in ("reward", "bestofn", "dpo"):
        if (OUT / f"{name}.json").exists():
            out[name] = json.loads((OUT / f"{name}.json").read_text())
    if (OUT / "pairs.json").exists():
        ps = json.loads((OUT / "pairs.json").read_text())
        out["pairs"] = {"count": len(ps), "example": ps[0]}
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

"""Chapter 22 — reasoning: chain of thought, test-time compute and reinforcement learning with verifiable rewards,
on a task small enough to train from scratch: adding two 6-digit numbers.

    uv run lmc ch22 train      # a small GPT on each format: direct answer, and scratchpad (≈ 10 min)
    uv run lmc ch22 vote       # accuracy of majority voting over k sampled answers (test-time compute)
    uv run lmc ch22 grpo       # GRPO on an under-trained direct model, reward = correct answer (≈ 10 min)
    uv run lmc ch22 summary    # collect into course/content/chapters/22-reasoning/data.json

Formats (characters):
    direct      348105+920377=1268482
    scratchpad  348105+920377=5+7+0=12,0+7+1=8,1+3+0=4,8+0+0=8,4+2+0=6,3+9+0=12>1268482
The scratchpad writes each column's digit sum (with the carry in) from the right, then the answer.
The loss is only on what follows "=" (the operands are random and cannot be predicted).
"""

from __future__ import annotations

import json
import math
import random
import time
from collections import Counter

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch22"
CHAPTER = ROOT / "course" / "content" / "chapters" / "22-reasoning"
DIGITS = 6
CHARS = "0123456789+=,>\n"
STOI = {c: i for i, c in enumerate(CHARS)}
CONTEXT = 96


def problem(rng: random.Random) -> tuple[int, int]:
    return rng.randrange(10**DIGITS), rng.randrange(10**DIGITS)


def render(a: int, b: int, fmt: str) -> tuple[str, str]:
    """(prompt, completion) for a + b in the given format; the completion ends with a newline."""
    prompt = f"{a}+{b}="
    if fmt == "direct":
        return prompt, f"{a + b}\n"
    steps, carry = [], 0
    da, db = str(a).zfill(DIGITS)[::-1], str(b).zfill(DIGITS)[::-1]
    for x, y in zip(da, db, strict=True):
        s = int(x) + int(y) + carry
        steps.append(f"{x}+{y}+{carry}={s}")
        carry = s // 10
    return prompt, ",".join(steps) + f">{a + b}\n"


def answer(completion: str) -> int | None:
    """The final answer in a completion: after ">" for the scratchpad, the whole line for the direct format."""
    line = completion.split("\n")[0]
    tail = line.split(">")[-1]
    return int(tail) if tail.isdigit() else None


def encode(s: str) -> list[int]:
    return [STOI[c] for c in s]


def decode(ids) -> str:
    return "".join(CHARS[i] for i in ids)


def batch(rng: random.Random, n: int, fmt: str):
    import torch

    x = torch.full((n, CONTEXT), STOI["\n"], dtype=torch.long)
    y = torch.full((n, CONTEXT), -100, dtype=torch.long)
    for r in range(n):
        p, c = render(*problem(rng), fmt)
        ids = encode("\n" + p + c)[: CONTEXT + 1]
        x[r, : len(ids) - 1] = torch.tensor(ids[:-1])
        start = len(p)  # predictions from the "=" onwards (index len(p) in ids is the first completion char)
        y[r, start : len(ids) - 1] = torch.tensor(ids[start + 1 :])
    return x, y


def new_model():
    from .model import GPT, GPTConfig

    return GPT(GPTConfig(vocab=len(CHARS), context=CONTEXT, width=256, layers=4, heads=4, pos="rope"))


def train_one(fmt: str, steps: int, dev, seed: int = 0, lr: float = 1e-3) -> tuple:
    import torch

    torch.manual_seed(seed)
    rng = random.Random(seed)
    model = new_model().to(dev)
    opt = model.optimizer(lr, weight_decay=0.0)
    curve = []
    test = [problem(random.Random(10_000 + i)) for i in range(500)]
    for step in range(steps):
        for g in opt.param_groups:
            g["lr"] = lr * min(1, (step + 1) / 100) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * step / steps)))
        x, y = batch(rng, 256, fmt)
        _, loss = model(x.to(dev), y.to(dev))
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        opt.zero_grad(set_to_none=True)
        if (step + 1) % 250 == 0:
            acc = accuracy(model, test, fmt, dev)
            curve.append([step + 1, round(loss.item(), 4), acc])
            print(f"  {fmt} step {step + 1}: loss {loss.item():.4f}, accuracy {acc:.1%}")
    return model, curve


def complete(model, prompts: list[str], dev, temperature: float = 0.0, max_new: int = CONTEXT, generator=None) -> list[str]:
    """Continue each prompt up to and including a newline (greedy at temperature 0)."""
    import torch

    with torch.no_grad():
        return _complete(model, prompts, dev, temperature, max_new, generator)


def _complete(model, prompts, dev, temperature, max_new, generator) -> list[str]:
    import torch

    model.eval()
    L = max(len(p) for p in prompts) + 1
    ids = torch.full((len(prompts), L), STOI["\n"], dtype=torch.long)
    for r, p in enumerate(prompts):  # right-align, so every row's next position is the same
        e = encode("\n" + p)
        ids[r, L - len(e) :] = torch.tensor(e)
    ids = ids.to(dev)
    out = torch.zeros((len(prompts), 0), dtype=torch.long, device=dev)
    done = torch.zeros(len(prompts), dtype=torch.bool, device=dev)
    for _ in range(min(max_new, CONTEXT - L)):
        logits, _ = model(torch.cat([ids, out], 1))
        z = logits[:, -1].float()
        nxt = z.argmax(-1) if temperature == 0 else torch.multinomial((z / temperature).softmax(-1), 1, generator=generator)[:, 0]
        nxt = torch.where(done, torch.full_like(nxt, STOI["\n"]), nxt)
        out = torch.cat([out, nxt[:, None]], 1)
        done |= nxt == STOI["\n"]
        if done.all():
            break
    model.train()
    texts = [decode(row.tolist()) for row in out]
    return [t[: t.index("\n") + 1] if "\n" in t else t for t in texts]


def accuracy(model, problems, fmt: str, dev) -> float:
    prompts = [f"{a}+{b}=" for a, b in problems]
    outs = []
    for i in range(0, len(prompts), 250):
        outs += complete(model, prompts[i : i + 250], dev)
    return sum(answer(o) == a + b for o, (a, b) in zip(outs, problems, strict=True)) / len(problems)


def train(steps: int = 3000) -> None:
    import torch

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    OUT.mkdir(parents=True, exist_ok=True)
    logs = {}
    for fmt in ("direct", "scratchpad"):
        t0 = time.time()
        model, curve = train_one(fmt, steps, dev)
        logs[fmt] = {"curve": curve, "seconds": time.time() - t0}
        torch.save(model.state_dict(), OUT / f"{fmt}.pt")
    # An under-trained direct model, the starting point for GRPO.
    model, curve = train_one("direct", 750, dev, seed=1)
    logs["direct-short"] = {"curve": curve}
    torch.save(model.state_dict(), OUT / "direct-short.pt")
    (OUT / "train.json").write_text(json.dumps(logs))


def _load(name: str, dev):
    import torch

    model = new_model().to(dev)
    model.load_state_dict(torch.load(OUT / f"{name}.pt", map_location=dev))
    return model


def vote(n: int = 400, ks: tuple[int, ...] = (1, 2, 4, 8, 16, 32)) -> None:
    """Self-consistency: sample k answers at temperature 1 and take the most common."""
    import torch

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    problems = [problem(random.Random(20_000 + i)) for i in range(n)]
    out = {}
    for fmt in ("direct", "scratchpad", "direct-short"):
        model = _load(fmt, dev)
        f = "direct" if fmt.startswith("direct") else "scratchpad"
        g = torch.Generator(device=dev).manual_seed(0)
        samples = [[] for _ in problems]
        prompts = [f"{a}+{b}=" for a, b in problems]
        for _ in range(max(ks)):
            outs = []
            for i in range(0, n, 200):
                outs += complete(model, prompts[i : i + 200], dev, temperature=1.0, generator=g)
            for s, o in zip(samples, outs, strict=True):
                s.append(answer(o))
        greedy = accuracy(model, problems, f, dev)
        curve = []
        for k in ks:
            correct = 0
            for s, (a, b) in zip(samples, problems, strict=True):
                votes = Counter(x for x in s[:k] if x is not None)
                correct += bool(votes) and votes.most_common(1)[0][0] == a + b
            curve.append([k, correct / n])
        # pass@k: is any of the k samples right? (what a perfect verifier could pick)
        passk = [[k, sum(any(x == a + b for x in s[:k]) for s, (a, b) in zip(samples, problems, strict=True)) / n] for k in ks]
        out[fmt] = {"greedy": greedy, "vote": curve, "pass": passk}
        print(fmt, "greedy", greedy, "vote", curve, "pass@k", passk)
    (OUT / "vote.json").write_text(json.dumps(out))


def grpo(steps: int = 900, prompts_per_step: int = 32, group: int = 8, lr: float = 2e-5, beta: float = 0.02, tag: str = "") -> None:
    """Group Relative Policy Optimisation (Shao et al., 2024) on the under-trained direct model. For each prompt,
    sample a group of answers; reward 1 if correct; advantage = (r − group mean) / (group std + ε); maximise
    Σ advantage · log π(answer) with a KL penalty towards the starting model."""
    import torch
    import torch.nn.functional as F

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    policy, ref = _load("direct-short", dev), _load("direct-short", dev)
    ref.eval()
    for p in ref.parameters():
        p.requires_grad_(False)
    opt = torch.optim.AdamW(policy.parameters(), lr=lr, weight_decay=0.0)
    rng = random.Random(5)
    g = torch.Generator(device=dev).manual_seed(5)
    test = [problem(random.Random(30_000 + i)) for i in range(1000)]
    eval_g = torch.Generator(device=dev).manual_seed(99)

    def sampled(k: int = 1, n: int = 500) -> float:
        """Fraction of the first n test problems with a correct answer among k samples at temperature 1."""
        probs = test[:n]
        prompts = [f"{a}+{b}=" for a, b in probs]
        hit = [False] * n
        for _ in range(k):
            outs = []
            for i in range(0, n, 250):
                outs += complete(policy, prompts[i : i + 250], dev, temperature=1.0, generator=eval_g)
            hit = [h or answer(o) == a + b for h, o, (a, b) in zip(hit, outs, probs, strict=True)]
        return sum(hit) / n

    curve = [[0, accuracy(policy, test, "direct", dev), 0.0, sampled()]]
    before = {"greedy": curve[0][1], "pass1": curve[0][3], "pass8": sampled(8)}
    print("GRPO start:", before)
    for step in range(1, steps + 1):
        probs = [problem(rng) for _ in range(prompts_per_step)]
        prompts = [f"{a}+{b}=" for a, b in probs for _ in range(group)]
        outs = complete(policy, prompts, dev, temperature=1.0, generator=g)
        rewards = torch.tensor([float(answer(o) == a + b) for o, (a, b) in zip(outs, [p for p in probs for _ in range(group)], strict=True)], device=dev)
        r = rewards.view(prompts_per_step, group)
        adv = ((r - r.mean(1, keepdim=True)) / (r.std(1, keepdim=True) + 1e-4)).flatten()
        # Log-probabilities of the sampled completions, recomputed with gradients.
        seqs = [encode("\n" + p + o) for p, o in zip(prompts, outs, strict=True)]
        T = max(len(s) for s in seqs)
        x = torch.full((len(seqs), T - 1), STOI["\n"], dtype=torch.long)
        y = torch.full((len(seqs), T - 1), -100, dtype=torch.long)
        for i, (s, p) in enumerate(zip(seqs, prompts, strict=True)):
            x[i, : len(s) - 1] = torch.tensor(s[:-1])
            y[i, len(p) : len(s) - 1] = torch.tensor(s[len(p) + 1 :])
        x, y = x.to(dev), y.to(dev)
        mask = (y != -100).float()
        logits, _ = policy(x)
        logp = -F.cross_entropy(logits.float().transpose(1, 2), y.clamp_min(0), reduction="none")
        with torch.no_grad():
            ref_logp = -F.cross_entropy(ref(x)[0].float().transpose(1, 2), y.clamp_min(0), reduction="none")
        # KL(π‖π_ref) per token with the unbiased "k3" estimator used by GRPO.
        kl = torch.exp(ref_logp - logp) - (ref_logp - logp) - 1
        per_token = -(adv[:, None] * logp) + beta * kl
        loss = ((per_token * mask).sum(1) / mask.sum(1).clamp_min(1)).mean()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(policy.parameters(), 1.0)
        opt.step()
        opt.zero_grad(set_to_none=True)
        if step % 50 == 0:
            acc, s1 = accuracy(policy, test, "direct", dev), sampled()
            curve.append([step, acc, float(rewards.mean()), s1])
            print(f"  GRPO step {step}: batch reward {rewards.mean():.2f}, greedy {acc:.1%}, one sample {s1:.1%}")
    after = {"greedy": curve[-1][1], "pass1": curve[-1][3], "pass8": sampled(8)}
    print("GRPO end:", after)
    (OUT / f"grpo{tag}.json").write_text(json.dumps({"curve": curve, "group": group, "prompts": prompts_per_step, "beta": beta, "lr": lr,
                                                     "before": before, "after": after}))


def summary() -> None:
    out = {"examples": {f: "".join(render(348105, 920377, f)).strip() for f in ("direct", "scratchpad")}}
    for name in ("train", "vote", "grpo"):
        if (OUT / f"{name}.json").exists():
            out[name] = json.loads((OUT / f"{name}.json").read_text())
    # A learning-rate sweep, if one was run (`grpo(lr=…, tag="-lr…")`).
    sweep = [json.loads(p.read_text()) for p in sorted(OUT.glob("grpo-lr*.json"))]
    if sweep:
        out["grpo_sweep"] = sorted(sweep, key=lambda r: r["lr"])
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

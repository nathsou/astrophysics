"""Chapter 23 — tool use: a small GPT learns to call a calculator instead of adding in its head.

    uv run lmc ch23 train      # a direct model and a tool-using model on three-term sums (≈ 10 min)
    uv run lmc ch23 evaluate   # accuracy by number of digits, with and without the tool
    uv run lmc ch23 export     # the tool-using model, for the browser
    uv run lmc ch23 summary    # collect into course/content/chapters/23-tool-use/data.json

Problems add three numbers of up to 6 digits. Formats (characters):
    direct  12+345+6789=7146
    tool    12+345+6789=[12+345=357][357+6789=7146]>7146
In the tool format the model writes a call, "[" up to and including "=", and the runtime appends the result and
"]": those characters are the tool's, so they carry no loss in training. Every sequence is shifted right by a
random number of newlines, so that every position up to the context length is trained (the browser engine uses
learned position embeddings, which would otherwise know nothing of the positions longer problems reach).
"""

from __future__ import annotations

import json
import math
import random
import time

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch23"
CHAPTER = ROOT / "course" / "content" / "chapters" / "23-tool-use"
CHARS = "0123456789+=[]>\n"
STOI = {c: i for i, c in enumerate(CHARS)}
CONTEXT = 128
TERMS = 3


def problem(rng: random.Random, digits: int | None = None) -> list[int]:
    """Three numbers; each has a random number of digits up to 6, or exactly `digits`."""
    out = []
    for _ in range(TERMS):
        d = digits or rng.randint(1, 6)
        out.append(rng.randrange(10 ** (d - 1) if d > 1 else 0, 10**d))
    return out


def render(nums: list[int], fmt: str) -> tuple[str, str, list[tuple[int, int]]]:
    """(prompt, completion, tool spans): each span is the (start, end) of tool output within the completion."""
    prompt = "+".join(map(str, nums)) + "="
    if fmt == "direct":
        return prompt, f"{sum(nums)}\n", []
    text, spans, acc = "", [], nums[0]
    for n in nums[1:]:
        text += f"[{acc}+{n}="
        acc += n
        spans.append((len(text), len(text) + len(str(acc)) + 1))
        text += f"{acc}]"
    return prompt, text + f">{acc}\n", spans


def answer(completion: str) -> int | None:
    tail = completion.split("\n")[0].split(">")[-1]
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
        p, c, spans = render(problem(rng), fmt)
        seq = "\n" + p + c
        pad = rng.randint(0, CONTEXT + 1 - len(seq))
        ids = encode("\n" * pad + seq)
        x[r, : len(ids) - 1] = torch.tensor(ids[:-1])
        tgt = torch.tensor(ids[1:])
        start = pad + len(p)  # target index of the first completion character
        keep = torch.zeros(len(ids) - 1, dtype=torch.bool)
        keep[start:] = True
        for a, b in spans:  # the tool's output is given, not predicted
            keep[start + a : start + b] = False
        y[r, : len(ids) - 1] = torch.where(keep, tgt, torch.full_like(tgt, -100))
    return x, y


def new_model():
    from .model import GPT, GPTConfig

    return GPT(GPTConfig(vocab=len(CHARS), context=CONTEXT, width=256, layers=4, heads=4))


def complete(model, prompts: list[str], dev, use_tool: bool, max_new: int = 100) -> list[str]:
    """Greedy completion. With `use_tool`, whenever the model finishes a call ("[a+b="), the runtime evaluates it
    and forces the result and "]" in place of the model's own next characters."""
    import torch

    model.eval()
    texts = ["" for _ in prompts]
    forced: list[list[str]] = [[] for _ in prompts]
    done = [False] * len(prompts)
    with torch.no_grad():
        for _ in range(max_new):
            seqs = [encode("\n" + p + t)[-CONTEXT:] for p, t in zip(prompts, texts, strict=True)]
            L = max(map(len, seqs))
            ids = torch.full((len(seqs), L), STOI["\n"], dtype=torch.long)
            for r, s in enumerate(seqs):  # right-aligned, so the next position is the last column for every row
                ids[r, L - len(s) :] = torch.tensor(s)
            nxt = model(ids.to(dev))[0][:, -1].argmax(-1).tolist()
            for r in range(len(prompts)):
                if done[r]:
                    continue
                c = forced[r].pop(0) if forced[r] else CHARS[nxt[r]]
                texts[r] += c
                if c == "\n":
                    done[r] = True
                elif use_tool and c == "=" and not forced[r]:
                    call = texts[r][texts[r].rfind("[") + 1 : -1]
                    if "[" in texts[r] and "]" not in texts[r][texts[r].rfind("[") :]:
                        try:
                            forced[r] = list(f"{sum(int(v) for v in call.split('+'))}]")
                        except ValueError:
                            forced[r] = list("]")
            if all(done):
                break
    model.train()
    return texts


def accuracy(model, problems, dev, use_tool: bool) -> float:
    prompts = ["+".join(map(str, p)) + "=" for p in problems]
    outs = []
    for i in range(0, len(prompts), 250):
        outs += complete(model, prompts[i : i + 250], dev, use_tool)
    return sum(answer(o) == sum(p) for o, p in zip(outs, problems, strict=True)) / len(problems)


def train(steps: int = 3000, lr: float = 1e-3) -> None:
    import torch

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    OUT.mkdir(parents=True, exist_ok=True)
    logs = {}
    test = [problem(random.Random(10_000 + i)) for i in range(500)]
    for fmt in ("direct", "tool"):
        torch.manual_seed(0)
        rng = random.Random(0)
        model = new_model().to(dev)
        opt = model.optimizer(lr, weight_decay=0.0)
        curve, t0 = [], time.time()
        for step in range(steps):
            for g in opt.param_groups:
                g["lr"] = lr * min(1, (step + 1) / 100) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * step / steps)))
            x, y = batch(rng, 256, fmt)
            _, loss = model(x.to(dev), y.to(dev))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            opt.zero_grad(set_to_none=True)
            if (step + 1) % 500 == 0:
                acc = accuracy(model, test, dev, fmt == "tool")
                curve.append([step + 1, round(loss.item(), 4), acc])
                print(f"  {fmt} step {step + 1}: loss {loss.item():.4f}, accuracy {acc:.1%}")
        logs[fmt] = {"curve": curve, "seconds": time.time() - t0}
        torch.save(model.state_dict(), OUT / f"{fmt}.pt")
    (OUT / "train.json").write_text(json.dumps(logs))


def _load(name: str, dev):
    import torch

    model = new_model().to(dev)
    model.load_state_dict(torch.load(OUT / f"{name}.pt", map_location=dev))
    return model


def evaluate(n: int = 300) -> None:
    """Accuracy by operand length, 1 to 9 digits (7 to 9 are longer than anything seen in training)."""
    import torch

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    direct, tool = _load("direct", dev), _load("tool", dev)
    out = {"digits": [], "direct": [], "tool": [], "tool_without": []}
    for d in range(1, 10):
        probs = [problem(random.Random(50_000 + 1000 * d + i), d) for i in range(n)]
        out["digits"].append(d)
        out["direct"].append(accuracy(direct, probs, dev, False))
        out["tool"].append(accuracy(tool, probs, dev, True))
        out["tool_without"].append(accuracy(tool, probs, dev, False))
        print(f"{d} digits: direct {out['direct'][-1]:.1%}, tool {out['tool'][-1]:.1%}, tool model without the tool {out['tool_without'][-1]:.1%}")
    ex = [[4821, 97, 30512], [123456789, 987654321, 555555555]]
    out["samples"] = [{"prompt": "+".join(map(str, p)) + "=", "direct": complete(direct, ["+".join(map(str, p)) + "="], dev, False)[0].strip(),
                       "tool": complete(tool, ["+".join(map(str, p)) + "="], dev, True)[0].strip(),
                       "tool_without": complete(tool, ["+".join(map(str, p)) + "="], dev, False)[0].strip()} for p in ex]
    (OUT / "evaluate.json").write_text(json.dumps(out))


def export() -> None:
    """The tool-using model as a browser safetensors file (float32 is small enough: 3 M parameters)."""
    import torch
    from safetensors.torch import save_file

    model = _load("tool", torch.device("cpu"))
    meta = {"format": "lm-course-gpt", "config": json.dumps({"vocab": len(CHARS), "context": CONTEXT, "width": 256, "layers": 4, "heads": 4}),
            "step": "3000", "chars": CHARS}
    path = OUT / "calculator.safetensors"
    save_file({k: v.to(torch.bfloat16) for k, v in model.state_for_browser().items()}, path, metadata=meta)
    print(f"wrote {path}")


def summary() -> None:
    out = {"examples": {f: "".join(render([12, 345, 6789], f)[:2]).strip() for f in ("direct", "tool")}}
    for name in ("train", "evaluate"):
        if (OUT / f"{name}.json").exists():
            out[name] = json.loads((OUT / f"{name}.json").read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

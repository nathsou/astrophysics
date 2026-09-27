"""Chapter 0 — a recorded tour of CourseGPT, for browsers without WebGPU: for a fixed prompt, the tokens,
and at each step of greedy generation the ten most probable next tokens.

    uv run lmc ch00          # writes course/content/chapters/00-what-is-a-language-model/tour.json
"""

from __future__ import annotations

import json

from .paths import ROOT

PROMPT = "Once upon a time, there was a little dog named"
OUT = ROOT / "course" / "content" / "chapters" / "00-what-is-a-language-model" / "tour.json"


def main(run: str = "coursegpt", steps: int = 24) -> None:
    import torch

    from .ch15 import load

    model, tok, dev = load(run)
    eot = tok.special["<|endoftext|>"]
    ids = [eot, *tok.encode(PROMPT)]

    def show(i: int) -> str:
        return "<|endoftext|>" if i == eot else tok.decode([i])

    record = []
    with torch.no_grad():
        for _ in range(steps):
            logits, _ = model(torch.tensor([ids], device=dev))
            p = logits[0, -1].float().softmax(-1)
            top = p.topk(10)
            record.append({"top": [[show(i), round(v, 4)] for v, i in zip(top.values.tolist(), top.indices.tolist(), strict=True)]})
            ids.append(int(top.indices[0]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "prompt": PROMPT,
        "prompt_tokens": [[show(i), i] for i in ids[1 : 1 + len(tok.encode(PROMPT))]],
        "steps": record,
    }, ensure_ascii=False) + "\n")
    print(f"wrote {OUT}: {PROMPT}{tok.decode(ids[1 + len(tok.encode(PROMPT)):])}")

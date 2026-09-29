"""Chapter 19 — mixture-of-experts, measured against Chapter 18's dense baseline at equal active compute.

    uv run lmc ch19 train      # 4 MoE runs of the 6 × 384 model, 2,127 steps each (≈ 45 min on an RTX 4060 Ti)
    uv run lmc ch19 routing    # expert loads per layer, and how one story is routed
    uv run lmc ch19 summary    # collect into course/content/chapters/19-mixture-of-experts/data.json

Each expert's hidden width is 4C / k, so a token's active MLP compute equals the dense model's, and every run
takes as many steps on as many tokens as the dense baseline (`arch-gpt2`, Chapter 18).
"""

from __future__ import annotations

import json

from .ch18 import BATCH, CONTEXT, LAYERS, WIDTH, _final, _steps
from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch19"
CHAPTER = ROOT / "course" / "content" / "chapters" / "19-mixture-of-experts"

VARIANTS: dict[str, tuple[str, list[str]]] = {
    "e8k2": ("8 experts, top-2", ["experts=8", "top_k=2"]),
    "e8k2-noaux": ("8 experts, top-2, no balancing loss", ["experts=8", "top_k=2", "aux_coef=0"]),
    "e8k1": ("8 experts, top-1 (Switch)", ["experts=8", "top_k=1"]),
    "e8k1-renorm": ("8 experts, top-1, gate renormalised", ["experts=8", "top_k=1", "gate=renorm"]),
    "e32k2": ("32 experts, top-2", ["experts=32", "top_k=2"]),
}


def train() -> None:
    from . import train as tr

    steps = _steps()
    for key, (label, sets) in VARIANTS.items():
        name = f"moe-{key}"
        f = _final(name)
        if f and f["step"] == steps:
            print(f"{name}: done")
            continue
        (TRAINING / "runs" / name / "log.jsonl").unlink(missing_ok=True)
        print(f"== {name}: {label}")
        tr.main("coursegpt", overrides=[
            f"name={name}", f"layers={LAYERS}", f"width={WIDTH}", f"heads={WIDTH // 64}", f"context={CONTEXT}",
            f"batch={BATCH}", "accum=1", f"steps={steps}", f"warmup={max(50, steps // 20)}", f"eval_every={steps}",
            "eval_tokens=2097152", "compile=false", *sets,
        ])


def _load(name: str):
    import torch

    from .model import GPT, GPTConfig

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt = torch.load(TRAINING / "runs" / name / "ckpt.pt", map_location=dev, weights_only=False)
    c = ckpt["config"]
    keys = ("context", "width", "layers", "heads", "norm_type", "mlp_type", "pos", "kv_heads", "experts", "top_k", "expert_hidden", "aux_coef", "gate")
    model = GPT(GPTConfig(vocab=8192, **{k: c[k] for k in keys if k in c})).to(dev)
    model.load_state_dict(ckpt["model"])
    return model.eval(), dev


def routing() -> None:
    import numpy as np
    import torch

    from . import tokens

    tok = tokens.tokeniser()
    val = np.asarray(tokens.load("val"))
    out: dict = {"loads": {}}
    for key in VARIANTS:
        if not (TRAINING / "runs" / f"moe-{key}" / "ckpt.pt").exists():
            continue
        model, dev = _load(f"moe-{key}")
        x = torch.from_numpy(val[: 64 * CONTEXT].astype(np.int64)).view(64, CONTEXT).to(dev)
        with torch.no_grad():
            model(x)
        out["loads"][key] = [[round(v, 4) for v in b.load.tolist()] for b in model.blocks]
        if key == "e8k2":
            eot = tok.special["<|endoftext|>"]
            start = int(np.flatnonzero(val == eot)[3]) + 1
            ids = val[start : start + 90].astype(np.int64)
            with torch.no_grad():
                model(torch.from_numpy(ids)[None].to(dev))
            out["story"] = {"tokens": [tok.decode([int(i)]) for i in ids],
                            "experts": [b.choice[0].tolist() for b in model.blocks]}
        print(key, "max load per layer:", [max(layer) for layer in out["loads"][key]])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "routing.json").write_text(json.dumps(out, ensure_ascii=False))


def summary() -> None:
    from .model import GPT, GPTConfig

    runs = []
    for key, label, sets in [("gpt2", "Dense (Chapter 18 baseline)", [])] + [(k, lbl, s) for k, (lbl, s) in VARIANTS.items()]:
        name = f"arch-{key}" if key == "gpt2" else f"moe-{key}"
        f = _final(name)
        if not f:
            continue
        opts = {k: (float(v) if k == "aux_coef" else int(v) if v.isdigit() else v) for k, v in (x.split("=") for x in sets)}
        cfg = GPTConfig(vocab=8192, context=CONTEXT, width=WIDTH, layers=LAYERS, heads=WIDTH // 64, **opts)
        total = GPT(cfg).num_parameters()
        E = cfg.experts
        per_expert = 2 * WIDTH * cfg.moe_hidden if E else 0
        active = total - (E - cfg.top_k) * per_expert * LAYERS if E else total
        runs.append({"key": key, "label": label, "val_bits": f["val_bits"], "tokens_per_s": f["tokens_per_s"],
                     "curve": f["curve"], "total_params": total, "active_params": active})
    out = {"runs": runs, "steps": _steps()}
    if (OUT / "routing.json").exists():
        out.update(json.loads((OUT / "routing.json").read_text()))
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")

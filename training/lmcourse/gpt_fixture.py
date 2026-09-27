"""Parity fixture for the browser GPT (Chapter 11): a small random model's weights, some input ids,
and the logits and loss PyTorch computes. The TypeScript test loads the weights into `Gpt` and
checks it computes the same numbers.

    uv run --extra torch python -m lmcourse.gpt_fixture
"""

from __future__ import annotations

import json

import torch

from .model import GPT, GPTConfig
from .paths import FIXTURES


def main() -> None:
    torch.manual_seed(3)
    cfg = GPTConfig(vocab=11, context=8, width=16, layers=2, heads=2)
    model = GPT(cfg).double()
    # Random (not initial) weights, so every parameter matters, including the LayerNorms.
    with torch.no_grad():
        for p in model.parameters():
            p.copy_(torch.randn_like(p) * 0.3)
    ids = torch.randint(cfg.vocab, (2, cfg.context))
    targets = torch.randint(cfg.vocab, (2, cfg.context))
    logits, loss = model(ids, targets)
    out = {
        "config": cfg.__dict__,
        "weights": {k: {"shape": list(v.shape), "data": v.flatten().tolist()} for k, v in model.state_for_browser().items()},
        "ids": ids.flatten().tolist(),
        "targets": targets.flatten().tolist(),
        "logits": logits.detach().flatten().tolist(),
        "loss": loss.item(),
    }
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / "gpt_parity.json").write_text(json.dumps(out) + "\n")
    # The same weights as safetensors files, which the TypeScript reader must decode.
    from safetensors.torch import save_file

    state = model.state_for_browser()
    save_file(state, FIXTURES / "gpt_parity.safetensors", metadata={"config": json.dumps(cfg.__dict__)})
    save_file({k: v.bfloat16() for k, v in state.items()}, FIXTURES / "gpt_parity_bf16.safetensors")
    print(f"wrote {FIXTURES / 'gpt_parity.json'} (loss {loss.item():.6f})")


if __name__ == "__main__":
    main()

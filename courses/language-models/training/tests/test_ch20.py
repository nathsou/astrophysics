"""Chapter 20: LoRA starts as the frozen model, trains only its low-rank factors, and merges exactly."""

import pytest

torch = pytest.importorskip("torch")

import torch.nn.utils.parametrize as P

from lmcourse.ch20 import add_lora, instruction
from lmcourse.model import GPT, GPTConfig


def test_lora_starts_unchanged_trains_only_factors_and_merges():
    torch.manual_seed(0)
    model = GPT(GPTConfig(vocab=40, context=16, width=32, layers=2, heads=2))
    ids = torch.randint(40, (2, 16))
    before = model(ids)[0].detach()
    params = add_lora(model, rank=2, alpha=4)
    assert torch.allclose(model(ids)[0], before, atol=1e-6)  # B = 0: no change yet
    assert sum(p.numel() for p in params) == 2 * (4 * (32 * 2 + 2 * 32) + (32 * 2 + 2 * 128) + (128 * 2 + 2 * 32))
    model(ids, ids)[1].backward()
    assert all(p.grad is not None for p in params)
    assert all(p.grad is None for n, p in model.named_parameters() if "original" in n)
    with torch.no_grad():
        for p in params:
            p.add_(torch.randn_like(p) * 0.1)
    tuned = model(ids)[0].detach()
    for block in model.blocks:
        for d in (block.attn, block.mlp):
            for k in list(d.keys()):
                P.remove_parametrizations(d, k, leave_parametrized=True)
    assert torch.allclose(model(ids)[0], tuned, atol=1e-5)  # merged weights compute the same function


def test_instruction_format():
    assert instruction("Lily", ["garden", "puppy", "rain"]) == "Write a story about Lily that uses the words: garden, puppy, rain.\nStory: "

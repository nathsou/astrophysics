"""Chapter 18: the modern block's pieces (CPU only)."""

import pytest

torch = pytest.importorskip("torch")

from lmcourse.model import GPT, GPTConfig, apply_rope, rope_tables


def test_rope_scores_depend_only_on_the_offset():
    torch.manual_seed(0)
    q, k = torch.randn(64), torch.randn(64)
    cos, sin = rope_tables(40, 64, 10000.0, "cpu")
    score = lambda i, j: (apply_rope(q[None], cos[i], sin[i]) * apply_rope(k[None], cos[j], sin[j])).sum()
    assert score(3, 1).item() == pytest.approx(score(23, 21).item(), rel=1e-4)
    assert score(0, 0).item() == pytest.approx((q * k).sum().item(), rel=1e-5)


@pytest.mark.parametrize("opts", [{}, {"norm_type": "rms"}, {"mlp_type": "swiglu"}, {"pos": "rope"}, {"kv_heads": 2},
                                  {"norm_type": "rms", "mlp_type": "swiglu", "pos": "rope", "kv_heads": 2}])
def test_every_variant_runs_and_is_causal(opts):
    torch.manual_seed(0)
    cfg = GPTConfig(vocab=50, context=16, width=64, layers=2, heads=4, **opts)
    model = GPT(cfg)
    ids = torch.randint(50, (2, 16))
    logits, loss = model(ids, ids)
    assert logits.shape == (2, 16, 50) and torch.isfinite(loss)
    # Changing a later token must not change earlier logits.
    ids2 = ids.clone()
    ids2[:, 10] = (ids2[:, 10] + 1) % 50
    assert torch.allclose(model(ids2)[0][:, :10], logits[:, :10], atol=1e-5)


def test_swiglu_and_gqa_parameter_counts():
    base = GPT(GPTConfig(vocab=50, context=16, width=384, layers=1, heads=6)).num_parameters()
    swiglu = GPT(GPTConfig(vocab=50, context=16, width=384, layers=1, heads=6, mlp_type="swiglu")).num_parameters()
    gqa = GPT(GPTConfig(vocab=50, context=16, width=384, layers=1, heads=6, kv_heads=2)).num_parameters()
    assert abs(swiglu - base) / base < 0.01  # ⅔ hidden width × 3 matrices ≈ 2 matrices
    assert base - gqa == 2 * 384 * (384 - 2 * 64)  # keys and values shrink from 6 heads to 2


def test_rope_model_runs_beyond_its_training_context():
    model = GPT(GPTConfig(vocab=50, context=16, width=64, layers=1, heads=4, pos="rope"))
    logits, _ = model(torch.randint(50, (1, 40)))
    assert logits.shape == (1, 40, 50)


def test_moe_routes_every_token_to_k_experts_and_balances():
    torch.manual_seed(0)
    cfg = GPTConfig(vocab=50, context=16, width=64, layers=2, heads=4, experts=4, top_k=2)
    model = GPT(cfg)
    ids = torch.randint(50, (3, 16))
    _, loss = model(ids, ids)
    assert torch.isfinite(loss)
    block = model.blocks[0]
    assert block.load.sum().item() == pytest.approx(1.0)
    assert block.aux.item() == pytest.approx(1.0, abs=0.2)  # E · Σ f·P is 1 for uniform routing, as at initialisation
    loss.backward()
    assert model.blocks[0].mlp["router"].grad.abs().sum() > 0  # the router learns through the gates

import random

from lmcourse import ch23


def test_tool_format_and_spans():
    p, c, spans = ch23.render([12, 345, 6789], "tool")
    assert p == "12+345+6789="
    assert c == "[12+345=357][357+6789=7146]>7146\n"
    # The tool's output (result and closing bracket) is what the spans cover.
    assert [c[a:b] for a, b in spans] == ["357]", "7146]"]
    assert ch23.answer(c) == 7146


def test_batch_masks_the_tool_output():
    _, y = ch23.batch(random.Random(0), 4, "tool")
    targets = "".join(ch23.CHARS[t] for t in y[0].tolist() if t != -100)
    assert "[" in targets and ">" in targets and "]" not in targets


def test_complete_forces_tool_results():
    import torch

    class Echo(torch.nn.Module):  # always predicts "=" then newline: the runtime must still insert the result
        def forward(self, ids):
            out = torch.full((*ids.shape, len(ch23.CHARS)), -1e9)
            out[:, :, ch23.STOI["\n"]] = 0.0
            return out, None

    texts = ch23.complete(Echo(), ["1+2+3="], torch.device("cpu"), use_tool=True)
    assert texts == ["\n"]

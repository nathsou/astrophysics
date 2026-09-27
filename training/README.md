# lmcourse — Python companion

Python side of *Language Models from Scratch*. It mirrors the TypeScript library (`packages/core`) so the two
can be checked against each other, and from Chapter 14 onwards it hosts the PyTorch training code.

```bash
uv sync                    # light environment (NumPy only) — enough until Chapter 14
uv sync --extra torch      # adds PyTorch: CUDA 13 wheels on Linux, MPS on macOS
uv run lmc data shakespeare
uv run lmc ch01
uv run pytest
```

On Linux the CUDA wheels need an NVIDIA driver ≥ 580. With an older driver, change `cu130` to `cu126` in
`pyproject.toml`.

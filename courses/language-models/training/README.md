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

## Training CourseGPT (Chapter 14)

```bash
uv run lmc data tinystories                 # TinyStories V2 (≈ 2.2 GB) into data/
uv run lmc tokenise                         # 8,192-token BPE, then data/tinystories/{train,val}.bin
uv run lmc train --preset smoke             # one-minute check that everything works
uv run lmc train --preset coursegpt         # ≈ 2 hours on an RTX 4060 Ti; resumable with --resume
uv run lmc train --preset coursegpt --export
uv run lmc ch14 fixtures                    # parity fixtures, and the tokeniser copied into the site
uv run lmc ch14 summary                     # the chapter's data file
```

Runs write `runs/<name>/{log.jsonl,ckpt.pt}`. Any preset field can be overridden with
`--set key=value …` (for example `--set lr=1e-3 layers=6 name=mine`).


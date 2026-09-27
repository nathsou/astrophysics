"""`lmc` — the course's command-line entry point (run with `uv run lmc …`)."""

from __future__ import annotations

import argparse


def main() -> None:
    p = argparse.ArgumentParser(prog="lmc", description="Language Models from Scratch — Python companion")
    sub = p.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("data", help="download a dataset into training/data/")
    from .data import DATASETS

    d.add_argument("name", choices=sorted(DATASETS))
    d.add_argument("--force", action="store_true", help="re-download even if present")

    c1 = sub.add_parser("ch01", help="Chapter 1: corpus statistics")
    c1.add_argument("--write-fixture", action="store_true", help="write the parity fixture used by the TypeScript tests")

    c2 = sub.add_parser("ch02", help="Chapter 2: n-gram models and smoothing")
    c2.add_argument("--max-order", type=int, default=6)
    c2.add_argument("--write-fixture", action="store_true")

    c3 = sub.add_parser("ch03", help="Chapter 3: train a byte-level BPE tokeniser")
    c3.add_argument("--merges", type=int, default=1024)
    c3.add_argument("--write-fixture", action="store_true")

    sub.add_parser("ch04", help="Chapter 4: strides in NumPy and PyTorch")
    c5 = sub.add_parser("ch05", help="Chapter 5: neural bigram model trained by SGD (PyTorch)")
    c5.add_argument("--steps", type=int, default=8000)
    c5.add_argument("--lr", type=float, default=20.0)
    sub.add_parser("ch06", help="Chapter 6: PyTorch's autograd graph")
    c7 = sub.add_parser("ch07", help="Chapter 7: MLP language model (PyTorch)")
    c7.add_argument("--layers", type=int, default=1)
    c7.add_argument("--hidden", type=int, default=512)
    c7.add_argument("--context", type=int, default=8)
    c7.add_argument("--steps", type=int, default=30_000)
    c7.add_argument("--optimizer", choices=["sgd", "adamw"], default="sgd")
    c7.add_argument("--lr", type=float, default=None)
    c7.add_argument("--device", default="cpu")

    c8 = sub.add_parser("ch08", help="Chapter 8: GPU bandwidth, matmul throughput and speed-ups")
    c8.add_argument("--triton", action="store_true", help="also benchmark a Triton matmul kernel (CUDA)")
    c9 = sub.add_parser("ch09", help="Chapter 9: character-level RNN / LSTM / GRU (PyTorch)")
    c9.add_argument("--cell", choices=["lstm", "gru", "rnn"], default="lstm")
    c9.add_argument("--hidden", type=int, default=256)
    c9.add_argument("--layers", type=int, default=1)
    c9.add_argument("--steps", type=int, default=2000)
    c9.add_argument("--batch", type=int, default=64)
    c9.add_argument("--bptt", type=int, default=64)
    c9.add_argument("--lr", type=float, default=3e-3)
    c9.add_argument("--dropout", type=float, default=0.0)
    c9.add_argument("--device", default="auto")
    c10 = sub.add_parser("ch10", help="Chapter 10: attention (lm | recall | speed)")
    c10.add_argument("what", choices=["lm", "recall", "speed"])
    c10.add_argument("--layers", type=int, default=2)
    c10.add_argument("--pairs", type=int, default=16)
    c10.add_argument("--steps", type=int, default=3000)
    c11 = sub.add_parser("ch11", help="Chapter 11: the Transformer on TinyShakespeare (PyTorch)")
    c11.add_argument("--layers", type=int, default=2)
    c11.add_argument("--width", type=int, default=128)
    c11.add_argument("--heads", type=int, default=4)
    c11.add_argument("--context", type=int, default=128)
    c11.add_argument("--steps", type=int, default=3000)
    c11.add_argument("--lr", type=float, default=3e-3)
    c11.add_argument("--dropout", type=float, default=0.0)
    c11.add_argument("--no-mlp", action="store_true")
    c11.add_argument("--no-norm", action="store_true")
    tr = sub.add_parser("train", help="Chapter 12+: train a GPT (presets: quick, chargpt, chargpt-big)")
    tr.add_argument("--preset", default="chargpt")
    tr.add_argument("--steps", type=int, default=None)
    tr.add_argument("--resume", action="store_true", help="continue from runs/<name>/ckpt.pt")
    tr.add_argument("--export", action="store_true", help="write runs/<name>/model.safetensors for the browser")
    args = p.parse_args()
    if args.cmd == "data":
        from .data import download

        print(download(args.name, force=args.force))
    elif args.cmd == "ch01":
        from . import ch01

        ch01.main(write_fixture=args.write_fixture)
    elif args.cmd == "ch02":
        from . import ch02

        ch02.main(max_order=args.max_order, write_fixture=args.write_fixture)
    elif args.cmd == "ch03":
        from . import ch03

        ch03.main(merges=args.merges, write_fixture=args.write_fixture)
    elif args.cmd == "ch04":
        from . import ch04

        ch04.main()
    elif args.cmd == "ch05":
        from . import ch05

        ch05.main(steps=args.steps, lr=args.lr)
    elif args.cmd == "ch06":
        from . import ch06

        ch06.main()
    elif args.cmd == "ch07":
        from . import ch07

        ch07.main(n=args.context, h=args.hidden, layers=args.layers, steps=args.steps,
                  optimizer=args.optimizer, lr=args.lr, device=args.device)
    elif args.cmd == "ch08":
        from . import ch08

        ch08.main(use_triton=args.triton)
    elif args.cmd == "ch09":
        from . import ch09

        ch09.main(
            cell=args.cell,
            hidden=args.hidden,
            layers=args.layers,
            steps=args.steps,
            batch=args.batch,
            bptt=args.bptt,
            lr=args.lr,
            dropout=args.dropout,
            device=args.device,
        )

    elif args.cmd == "ch10":
        from . import ch10

        if args.what == "lm":
            ch10.lm(layers=args.layers, steps=args.steps)
        elif args.what == "recall":
            ch10.recall(pairs=args.pairs, steps=args.steps)
        else:
            ch10.speed()
    elif args.cmd == "ch11":
        from . import ch11

        ch11.main(
            layers=args.layers,
            width=args.width,
            heads=args.heads,
            context=args.context,
            steps=args.steps,
            lr=args.lr,
            dropout=args.dropout,
            mlp=not args.no_mlp,
            norm=not args.no_norm,
        )
    elif args.cmd == "train":
        from . import train

        train.main(preset=args.preset, resume=args.resume, export=args.export, steps=args.steps)

if __name__ == "__main__":
    main()

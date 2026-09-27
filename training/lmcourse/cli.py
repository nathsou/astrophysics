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


if __name__ == "__main__":
    main()

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


if __name__ == "__main__":
    main()

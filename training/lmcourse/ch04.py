"""Chapter 4 lab: strides in NumPy and PyTorch, side by side with the course library's widget."""

from __future__ import annotations

import numpy as np


def main() -> None:
    x = np.arange(24, dtype=np.float32).reshape(2, 3, 4)
    views = {
        "x": x,
        "x.transpose(0, 2, 1)": x.transpose(0, 2, 1),
        "x.transpose(2, 0, 1)": x.transpose(2, 0, 1),
        "x[:, 1:3, :]": x[:, 1:3, :],
        "x[..., ::2]": x[..., ::2],
        "broadcast_to(x[:, :1], (2, 3, 4))": np.broadcast_to(x[:, :1], (2, 3, 4)),
        "x.reshape(4, 6)": x.reshape(4, 6),
    }
    print("NumPy reports strides in BYTES (float32 = 4 bytes); divide by 4 to compare with the widget.\n")
    print(f"{'expression':38} {'shape':14} {'strides (bytes)':18} {'elements':14} contiguous  shares x")
    for name, v in views.items():
        elems = tuple(s // v.itemsize for s in v.strides)
        print(f"{name:38} {v.shape!s:14} {v.strides!s:18} {elems!s:14} {v.flags['C_CONTIGUOUS']!s:11} {np.shares_memory(v, x)}")
    try:
        import torch
    except ImportError:
        print("\n(Install the torch extra to compare with PyTorch: uv sync --extra torch)")
        return
    t = torch.arange(24.0).reshape(2, 3, 4)
    print("\nPyTorch reports strides in ELEMENTS:")
    print(f"  t.stride() = {t.stride()},  t.transpose(1, 2).stride() = {t.transpose(1, 2).stride()}")
    print(f"  t.transpose(1, 2).is_contiguous() = {t.transpose(1, 2).is_contiguous()}")
    try:
        t.transpose(1, 2).view(2, 12)
    except RuntimeError as e:
        print(f"  t.transpose(1, 2).view(2, 12) → RuntimeError: {str(e).splitlines()[0][:80]}…")

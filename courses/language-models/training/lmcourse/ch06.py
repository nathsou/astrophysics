"""Chapter 6 lab: PyTorch's autograd graph for tanh(w·x + b), walked through grad_fn."""

from __future__ import annotations


def main() -> None:
    try:
        import torch
    except ImportError:
        print("This lab needs PyTorch: uv sync --extra torch")
        return
    w = torch.tensor(0.8, requires_grad=True)
    x = torch.tensor(2.0, requires_grad=True)
    b = torch.tensor(-0.5, requires_grad=True)
    y = torch.tanh(w * x + b)
    print(f"y = tanh(w·x + b) = {y.item():.6f}\n\nBackward graph (walking grad_fn):")

    def walk(fn, depth=0):
        if fn is None:
            return
        print("  " * depth + type(fn).__name__)
        for nxt, _ in fn.next_functions:
            walk(nxt, depth + 1)

    walk(y.grad_fn)
    y.backward()
    t = y.item()
    print("\nGradients (compare with the graph widget's 'A neuron' preset):")
    print(f"  dy/dw = {w.grad.item():.6f}   (1 − y²)·x = {(1 - t * t) * 2:.6f}")
    print(f"  dy/dx = {x.grad.item():.6f}   (1 − y²)·w = {(1 - t * t) * 0.8:.6f}")
    print(f"  dy/db = {b.grad.item():.6f}   (1 − y²)   = {1 - t * t:.6f}")

# Fibonacci numbers: 1, 1, 2, 3, 5, 8, ... as long as they fit in a byte.
# Each one is stored in the table fib and shown on the hex display.
# Shows: a loop that stops on a comparison, and a pointer walking through memory.

        li   a0, 0              # a
        li   a1, 1              # b
        la   a2, fib            # where the next number goes
        li   t0, 256            # the limit
loop:   sw   a1, 0(a2)          # store b
        sw   a1, HEX(zero)
        addi a2, a2, 4
        add  a3, a0, a1         # next = a + b
        mv   a0, a1
        mv   a1, a3
        blt  a1, t0, loop       # stop when it no longer fits in a byte
        ebreak

fib:    .space 52               # 1 1 2 3 5 8 13 21 34 55 89 144 233: 13 words

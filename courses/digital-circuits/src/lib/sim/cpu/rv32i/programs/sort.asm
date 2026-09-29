# Sort 8 bytes into ascending order (unsigned), by bubble sort:
# sweep through the list swapping neighbours that are out of order, until a sweep swaps nothing.
# Shows: a pointer, compare-and-branch on unsigned values, and a flag kept in a register.

        la   a2, data           # the start of the list
        addi a3, a2, 7          # the last element

sweep:  li   t0, 0              # swapped = 0
        mv   a0, a2             # a0 -> a[i]
pair:   lbu  t1, 0(a0)
        lbu  t2, 1(a0)          # a[i + 1]
        bgeu t2, t1, next       # in order already
        sb   t2, 0(a0)          # swap them
        sb   t1, 1(a0)
        li   t0, 1
next:   addi a0, a0, 1
        bne  a0, a3, pair
        bnez t0, sweep
        ebreak

data:   .byte 42, 7, 255, 0, 128, 7, 99, 1

# Conway's Game of Life on the 8 x 8 matrix. The edges wrap round (a torus), so a glider
# flies for ever. A cell is born with 3 neighbours and survives with 2 or 3.
#
# Where Octet counts one cell at a time, this program counts all 8 cells of a row at once:
# every bit position of a register is its own cell, so a bitwise full adder adds up the
# 8 neighbours of all 8 cells together (a "bit-sliced" adder). The rule is then the single
# test  (neighbours OR alive) = 3  again: bit 1 set, bit 2 and up clear, and (bit 0 OR alive).
#
# grid holds the current generation (one byte per row); each new row goes straight to the
# matrix, and the matrix is copied back into grid when all 8 rows are done.
# Edit grid to start from another pattern.

        .equ DELAY, 500         # pause between generations: turns of the delay loop (4 cycles each)

gen:    li   s0, 0              # s0 = the row being computed
row:    addi t0, s0, 7          # the row above (wrapping round: (row - 1) mod 8)
        andi t0, t0, 7
        lbu  a0, grid(t0)
        jal  ext
        mv   s1, a0             # s1 = the row above, widened
        lbu  a0, grid(s0)
        jal  ext
        mv   s2, a0             # s2 = this row, widened
        addi t0, s0, 1          # the row below
        andi t0, t0, 7
        lbu  a0, grid(t0)
        jal  ext
        mv   s3, a0             # s3 = the row below, widened

        # A widened row w has bit k+1 = the cell in column k, bit k = its right neighbour and
        # bit k+2 = its left neighbour. So w, w >> 1 and w >> 2 line up the three cells of a
        # row under every column at once. (Bits above 7 are junk that never reaches bit 7 or
        # below, because every operation here works on each bit position separately.)

        # (s4 sum, s5 carry) = full adder of the three cells above
        srli a1, s1, 1
        srli a2, s1, 2
        xor  t0, s1, a1
        xor  s4, t0, a2
        and  t1, s1, a1
        and  t2, a2, t0
        or   s5, t1, t2
        # (s6, s7) = full adder of the cells to the right and left of this one and the cell below-right
        srli a1, s2, 2
        xor  t0, s2, a1         # s2 and s2 >> 2 are the two neighbours; the cell itself (s2 >> 1) is skipped
        xor  s6, t0, s3
        and  t1, s2, a1
        and  t2, s3, t0
        or   s7, t1, t2
        # (s8, s9) = half adder of the cells below and below-left
        srli a1, s3, 1
        srli a2, s3, 2
        xor  s8, a1, a2
        and  s9, a1, a2
        # (a3 = ones bit, a4 carry) = full adder of the three sums
        xor  t0, s4, s6
        xor  a3, t0, s8
        and  t1, s4, s6
        and  t2, s8, t0
        or   a4, t1, t2
        # (a5, a6) = full adder of the three carries
        xor  t0, s5, s7
        xor  a5, t0, s9
        and  t1, s5, s7
        and  t2, s9, t0
        or   a6, t1, t2
        # (a7 = twos bit, t1 = fours) = half adder of a5 and the carry a4
        xor  a7, a5, a4
        and  t1, a5, a4
        or   t1, t1, a6         # 4 or more neighbours?
        not  t1, t1
        and  t1, t1, a7         # 2 or 3 neighbours
        srli t0, s2, 1          # this row
        or   t0, t0, a3         # (alive OR odd number of neighbours)
        and  t1, t1, t0
        sb   t1, MATRIX(s0)     # bits 8 and up are dropped by the byte store

        addi s0, s0, 1
        li   t0, 8
        bne  s0, t0, row

        lw   t0, MATRIX(zero)   # copy the matrix back into grid, four rows at a time
        sw   t0, grid(zero)
        lw   t0, MATRIX + 4(zero)
        sw   t0, grid + 4(zero)
        jal  delay
        j    gen

# ext: widen the row in a0 by one cell each side, wrapping round: bit 0 = column 7's
# neighbour on the far side, bits 1-8 = the row, bit 9 = column 0's neighbour. Uses t5, t6.
ext:    slli t6, a0, 1
        srli t5, a0, 7
        or   t6, t6, t5
        andi t5, a0, 1
        slli t5, t5, 9
        or   a0, t6, t5
        ret

# delay: wait DELAY turns of an empty loop. Uses t0.
delay:  li   t0, DELAY
wait:   addi t0, t0, -1
        bnez t0, wait
        ret

        .align 2
grid:   .byte 0b01000000        # a glider
        .byte 0b00100000
        .byte 0b11100000
        .byte 0, 0, 0, 0, 0

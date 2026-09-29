# Pong on the 8 x 8 matrix, for one player. BTN0 moves the paddle left, BTN1 right.
# Every return scores a point (on the hex display); miss the ball and the game stops.
# The ball's column is kept as a one-bit mask, so moving it is a shift and
# "is the paddle under the ball?" is an AND. Everything lives in registers:
#   s0 ball column (mask)   s1 ball row (0 = top)   s2 dx (0 right, 1 left)   s3 dy (+1 down, -1 up)
#   s4 paddle (mask)        s5 score

        .equ DELAY, 1000        # frame delay: turns of the delay loop (5 cycles each)

        li   s0, 0x10
        li   s1, 1
        li   s2, 0
        li   s3, 1
        li   s4, 0b00111000
        li   s5, 0

frame:  jal  delay

        # ---- the paddle
        lw   t0, BUTTONS(zero)
        andi t1, t0, 1          # BTN0: left
        beqz t1, noleft
        andi t2, s4, 0x80       # already at the left edge?
        bnez t2, noleft
        slli s4, s4, 1
noleft: andi t1, t0, 2          # BTN1: right
        beqz t1, noright
        andi t2, s4, 1          # already at the right edge?
        bnez t2, noright
        srli s4, s4, 1
noright: sb  s4, MATRIX + 7(zero)

        # ---- rub out the ball, then move it sideways
        sb   zero, MATRIX(s1)   # MATRIX + row: the register adds the row to the offset
        bnez s2, left
        srli s0, s0, 1          # moving right
        li   t0, 0x01
        bne  s0, t0, vert
        li   s2, 1              # at the right wall: go left next time
        j    vert
left:   slli s0, s0, 1          # moving left
        li   t0, 0x80
        bne  s0, t0, vert
        li   s2, 0              # at the left wall: go right next time

        # ---- move it up or down
vert:   add  s1, s1, s3
        bnez s1, nottop
        li   s3, 1              # top wall: go down
nottop: li   t0, 6
        bne  s1, t0, notnear
        and  t1, s4, s0         # just above the paddle: is it under the ball?
        beqz t1, draw           # no: keep falling
        li   s3, -1             # yes: bounce, and score
        addi s5, s5, 1
        sw   s5, HEX(zero)
        j    draw
notnear: li  t0, 7
        bne  s1, t0, draw
        or   t1, s0, s4         # missed: draw the ball beside the paddle and stop
        sb   t1, MATRIX + 7(zero)
        ebreak
draw:   sb   s0, MATRIX(s1)
        j    frame

# delay: wait DELAY turns of an empty loop. Uses t0.
delay:  li   t0, DELAY
wait:   addi t0, t0, -1
        bnez t0, wait
        ret

# A light walks along the LEDs and back. The hex display counts its steps.
# The RISC-V twin of walk.asm: the same walk, with shifts by any amount and a branch that compares two registers.

        .equ WAIT, 6            # turns of the delay loop between steps

        li   a1, 0              # steps so far
        li   a0, 1              # the light
        li   a2, 0x100          # one past the top LED
left:   jal  step
        slli a0, a0, 1
        bne  a0, a2, left
        li   a0, 0x40
right:  jal  step
        srli a0, a0, 1
        bnez a0, right
        li   a0, 2
        j    left

# step: show the light, count the step, and wait. Uses t0.
step:   sw   a0, LEDS(zero)
        addi a1, a1, 1
        sw   a1, HEX(zero)
        li   t0, WAIT
pause:  addi t0, t0, -1
        bnez t0, pause
        ret

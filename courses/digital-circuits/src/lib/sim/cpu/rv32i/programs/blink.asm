# Blink: light the left and right halves of the LEDs in turn, forever.
# Shows: a loop, xori, and calling a subroutine (jal and ret).

        .equ DELAY, 2060        # turns of the delay loop per half period (5 cycles each)

        li   a0, 0x0F           # the right half first
loop:   sw   a0, LEDS(zero)     # the board's registers sit at the top of memory, so
        xori a0, a0, 0xFF       #   a 12-bit offset from zero reaches them: 0x0F <-> 0xF0
        jal  delay
        j    loop

# delay: wait DELAY turns of an empty loop. Uses t0.
delay:  li   t0, DELAY
wait:   addi t0, t0, -1
        bnez t0, wait
        ret

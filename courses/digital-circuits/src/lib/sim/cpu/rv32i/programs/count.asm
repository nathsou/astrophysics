# Count from 0 to 255 on the LEDs and the hex display, then stop.
# Shows: a counting loop that ends when the counter reaches a limit held in a register.

        .equ DELAY, 515         # turns of the delay loop per count (5 cycles each)

        li   a0, 0              # the count
        li   a1, 256            # the limit
loop:   sw   a0, LEDS(zero)
        sw   a0, HEX(zero)
        jal  delay
        addi a0, a0, 1
        bne  a0, a1, loop
        ebreak

# delay: wait DELAY turns of an empty loop. Uses t0.
delay:  li   t0, DELAY
wait:   addi t0, t0, -1
        bnez t0, wait
        ret

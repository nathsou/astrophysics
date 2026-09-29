# Reaction timer. Release BTN0 and wait: after a random time every LED lights.
# Press BTN0 as fast as you can: the hex display shows how long you took, in ticks
# (one tick is 8,192 clock cycles, read from the TIMER). Press too early and it shows EE.
# Press again to play again.
# Shows: polling a button, the RANDOM and TIMER registers, and comparing times with a
# subtraction so that the timer wrapping round does not matter.

        .equ TICK, 13           # a tick is 2^13 cycles
        .equ FALSE_START, 0xEE

start:  sw   zero, LEDS(zero)
release: lw  t0, BUTTONS(zero)  # wait until BTN0 is up
        andi t0, t0, 1
        bnez t0, release

        lw   t0, RANDOM(zero)   # wait 1-128 ticks
        andi t0, t0, 0x7F
        addi t0, t0, 1
        slli t0, t0, TICK
        lw   t1, TIMER(zero)
        add  t2, t1, t0         # the deadline
wait:   lw   t3, BUTTONS(zero)
        andi t3, t3, 1
        bnez t3, early          # pressed before the LEDs lit
        lw   t3, TIMER(zero)
        sub  t3, t3, t2
        bltz t3, wait           # not there yet

        li   t0, 0xFF           # go!
        sw   t0, LEDS(zero)
        lw   t1, TIMER(zero)    # the start time
        li   t5, 255
time:   lw   t3, BUTTONS(zero)
        andi t3, t3, 1
        bnez t3, pressed
        lw   t3, TIMER(zero)
        sub  t3, t3, t1
        srli t3, t3, TICK
        blt  t3, t5, time
        li   a0, 0xFF           # too slow: show FF
        j    show
pressed: lw  t3, TIMER(zero)
        sub  t3, t3, t1
        srli a0, t3, TICK
        blt  a0, t5, show
        li   a0, 0xFF
show:   sw   a0, HEX(zero)
        j    again

early:  li   a0, FALSE_START
        sw   a0, HEX(zero)
again:  lw   t0, BUTTONS(zero)  # wait for release, then a press, to play again
        andi t0, t0, 1
        bnez t0, again
press:  lw   t0, BUTTONS(zero)
        andi t0, t0, 1
        beqz t0, press
        j    start

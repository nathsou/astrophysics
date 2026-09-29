# Multiply two numbers by shift-and-add, the way you multiply on paper:
# for every 1 bit of y, add x (shifted to that bit's place) to the product.
# The product goes to the hex display (all 16 bits) and its low byte to the LEDs.
# Shows: shifts and masks, and a label used as a 12-bit offset from zero (x, y and
# product live below address 2048, so lw t0, x(zero) is one instruction).

        lw   t0, x(zero)        # t0 = x, shifted left one place per round
        lw   t1, y(zero)        # t1 = y, shifted right one place per round
        li   a0, 0              # the product
loop:   andi t2, t1, 1          # the lowest bit of y
        beqz t2, skip
        add  a0, a0, t0         # product += x << place
skip:   slli t0, t0, 1
        srli t1, t1, 1
        bnez t1, loop           # any 1 bits left in y?

        sw   a0, product(zero)
        sw   a0, HEX(zero)
        sw   a0, LEDS(zero)     # only the low 8 bits fit on the LEDs
        ebreak

x:      .word 13
y:      .word 11
product: .word 0

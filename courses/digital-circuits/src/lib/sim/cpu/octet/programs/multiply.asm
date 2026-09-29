; Multiply two 8-bit numbers by shift-and-add, the way you multiply on paper:
; for every 1 bit of y, add x (shifted to that bit's place) to the product.
; The product has 16 bits: hi on the hex display, lo on the LEDs.
; Shows: shifts, the carry flag, and 16-bit arithmetic from 8-bit parts.

        LD   R0, [x]            ; R1:R0 = x, shifted left one place per round
        LDI  R1, 0
        LD   R2, [y]            ; R2 = y, shifted right one place per round
        LDI  R3, 0
        ST   [lo], R3           ; product = 0
        ST   [hi], R3

loop:   SHR  R2                 ; C = the next bit of y
        JNC  skip
        LD   R3, [lo]           ; product += R1:R0
        ADD  R3, R0
        ST   [lo], R3
        LD   R3, [hi]           ; loads leave the flags alone, so C is still
        JNC  nocarry            ; the carry out of the low byte
        INC  R3
nocarry: ADD R3, R1
        ST   [hi], R3
skip:   SHL  R1                 ; R1:R0 <<= 1: the bit leaving R0 enters R1
        SHL  R0
        JNC  more
        INC  R1
more:   OR   R2, R2             ; any 1 bits left in y? (OR sets Z)
        JNZ  loop

        LD   R3, [hi]
        ST   [HEX], R3
        LD   R3, [lo]
        ST   [LEDS], R3
        HLT

x:      .byte 13
y:      .byte 11
lo:     .byte 0
hi:     .byte 0

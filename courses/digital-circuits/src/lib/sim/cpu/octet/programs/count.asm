; Count from 0 to 255 on the LEDs and the hex display, then stop.
; Shows: a counting loop that ends when INC wraps round to zero.

        .equ DELAY, 1           ; slow it down so you can watch (× 2,575 cycles per count)

        LDI  R0, 0
loop:   ST   [LEDS], R0
        ST   [HEX], R0
        CALL delay
        INC  R0                 ; 255 + 1 = 0 sets Z …
        JNZ  loop               ; … which ends the loop
        HLT

; delay: wait DELAY × 256 turns of an empty loop. Uses R2 and R3.
delay:  LDI  R2, 0 - DELAY
outer:  LDI  R3, 0
inner:  INC  R3
        JNZ  inner
        INC  R2
        JNZ  outer
        RET

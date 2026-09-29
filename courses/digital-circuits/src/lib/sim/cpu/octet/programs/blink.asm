; Blink: light the left and right halves of the LEDs in turn, forever.
; Shows: a loop, NOT, and calling a subroutine.

        .equ DELAY, 4           ; how long each half stays lit (× 2,575 cycles)

        LDI  R0, 0x0F           ; the right half first
loop:   ST   [LEDS], R0
        NOT  R0                 ; swap halves: 0x0F <-> 0xF0
        CALL delay
        JMP  loop

; delay: wait DELAY × 256 turns of an empty loop. Uses R2 and R3.
; Octet has no DEC, so both counters count *up* to zero.
delay:  LDI  R2, 0 - DELAY
outer:  LDI  R3, 0
inner:  INC  R3
        JNZ  inner              ; 256 times round
        INC  R2
        JNZ  outer
        RET

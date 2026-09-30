; A light walks along the LEDs and back. The hex display counts its steps.
; Shows: SHL and SHR (the bit that falls off the end lands in C), a subroutine, and a stored count.

        .equ WAIT, 8            ; turns of the delay loop between steps (10 cycles each)

        LDI  R1, 0              ; steps so far
        LDI  R0, 0x01           ; the light
left:   CALL step
        SHL  R0                 ; from 0x80 the 1 falls out into C
        JNC  left
        LDI  R0, 0x40
right:  CALL step
        SHR  R0                 ; from 0x01 the 1 falls out into C
        JNC  right
        LDI  R0, 0x02
        JMP  left

; step: show the light, count the step, and wait. Uses R2.
step:   ST   [LEDS], R0
        INC  R1
        ST   [HEX], R1
        LDI  R2, 0 - WAIT
pause:  INC  R2
        JNZ  pause
        RET

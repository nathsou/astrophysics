; Reaction timer. Release BTN0 and wait: after a random time every LED lights.
; Press BTN0 as fast as you can: the hex display shows how long you took, in ticks
; (one tick is about 6,700 clock cycles). Press too early and it shows EE.
; Press again to play again.
; Shows: polling a button, the RANDOM port, and a subroutine that returns a flag.

        .equ TICK, 0            ; loop turns per tick (0 means 256)
        .equ FALSE_START, 0xEE

start:  LDI  R0, 0
        ST   [LEDS], R0
release: LD  R0, [BUTTONS]      ; wait until BTN0 is up
        SHR  R0                 ; C = BTN0
        JC   release

        LD   R1, [RANDOM]       ; wait 1–128 ticks: count R1 up from 0x80–0xFF to 0
        LDI  R0, 0x80
        OR   R1, R0
wait:   CALL tick
        JC   early              ; pressed before the LEDs lit
        INC  R1
        JNZ  wait

        LDI  R0, 0xFF           ; go!
        ST   [LEDS], R0
        LDI  R1, 0              ; count ticks until the press
time:   CALL tick
        JC   done
        INC  R1
        JNZ  time
        LDI  R1, 0xFF           ; too slow: show FF
done:   ST   [HEX], R1
        JMP  again

early:  LDI  R0, FALSE_START
        ST   [HEX], R0
again:  LD   R0, [BUTTONS]      ; wait for release, then a press, to play again
        SHR  R0
        JC   again
press:  LD   R0, [BUTTONS]
        SHR  R0
        JNC  press
        JMP  start

; tick: wait one tick while watching BTN0. Returns C = 1 as soon as BTN0 is down,
; C = 0 if the tick ran out. Uses R0 and R2.
tick:   LDI  R2, 0 - TICK
poll:   LD   R0, [BUTTONS]
        SHR  R0                 ; C = BTN0
        JC   ticked
        INC  R2
        JNZ  poll
        OR   R2, R2             ; logic operations clear C
ticked: RET

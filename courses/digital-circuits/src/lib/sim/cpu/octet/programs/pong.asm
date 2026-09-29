; Pong on the 8 × 8 matrix, for one player. BTN0 moves the paddle left, BTN1 right.
; Every return scores a point (on the hex display); miss the ball and the game stops.
; The ball's column is kept as a one-bit mask, so moving it is a shift and
; "is the paddle under the ball?" is an AND.

        .equ DELAY, 2           ; frame delay (× 2,575 cycles)
        .equ BOTTOM, MATRIX + 7 ; the paddle's row

frame:  CALL delay

        ; ---- the paddle
        LD   R2, [pad]
        LD   R0, [BUTTONS]
        SHR  R0                 ; C = BTN0: left
        JNC  noleft
        MOV  R3, R2
        SHL  R3                 ; C = 1 if the paddle is already at the left edge
        JC   noleft
        MOV  R2, R3
noleft: SHR  R0                 ; C = BTN1: right
        JNC  noright
        MOV  R3, R2
        SHR  R3
        JC   noright
        MOV  R2, R3
noright: ST  [pad], R2
        ST   [BOTTOM], R2

        ; ---- rub out the ball, then move it sideways
        LD   R1, [by]
        LDI  R0, 0
        STR  [R1], R0
        LD   R0, [bx]
        LD   R3, [dx]
        OR   R3, R3
        JNZ  left
        SHR  R0                 ; moving right
        LDI  R3, 0x01
        CMP  R0, R3
        JNZ  vert
        LDI  R3, 1              ; at the right wall: go left next time
        ST   [dx], R3
        JMP  vert
left:   SHL  R0                 ; moving left
        LDI  R3, 0x80
        CMP  R0, R3
        JNZ  vert
        LDI  R3, 0              ; at the left wall: go right next time
        ST   [dx], R3
vert:   ST   [bx], R0

        ; ---- move it up or down
        LD   R3, [dy]
        ADD  R1, R3             ; R1 = the ball's new row address
        ST   [by], R1
        LDI  R3, MATRIX
        CMP  R1, R3
        JNZ  nottop
        LDI  R3, 1              ; top wall: go down
        ST   [dy], R3
nottop: LDI  R3, MATRIX + 6
        CMP  R1, R3
        JNZ  notnear
        AND  R2, R0             ; just above the paddle: is it under the ball?
        JZ   draw               ; no: keep falling
        LDI  R3, 0 - 1          ; yes: bounce, and score
        ST   [dy], R3
        LD   R3, [score]
        INC  R3
        ST   [score], R3
        ST   [HEX], R3
        JMP  draw
notnear: LDI R3, BOTTOM
        CMP  R1, R3
        JNZ  draw
        OR   R0, R2             ; missed: draw the ball beside the paddle and stop
        STR  [R1], R0
        HLT
draw:   STR  [R1], R0
        JMP  frame

; delay: wait DELAY × 256 turns of an empty loop. Uses R2 and R3.
delay:  LDI  R2, 0 - DELAY
outer:  LDI  R3, 0
inner:  INC  R3
        JNZ  inner
        INC  R2
        JNZ  outer
        RET

bx:     .byte 0x10              ; ball column (mask)
by:     .byte MATRIX + 1        ; ball row (address)
dx:     .byte 0                 ; 0: moving right, 1: moving left
dy:     .byte 1                 ; +1: moving down, −1: moving up
pad:    .byte 0b00111000        ; paddle (mask)
score:  .byte 0

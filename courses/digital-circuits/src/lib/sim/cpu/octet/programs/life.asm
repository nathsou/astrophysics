; Conway's Game of Life on the 8 × 8 matrix. The edges wrap round (a torus), so a glider
; flies for ever. A cell is born with 3 neighbours and survives with 2 or 3; the program
; uses the trick "(neighbours OR alive) = 3", which covers all three cases in one test.
;
; The buffer grid holds the current generation with row 7 repeated above row 0 and row 0
; below row 7, so every row has a row above and below it. Each generation is computed
; from grid into the matrix, then the matrix is copied back into grid.
; Edit grid to start from another pattern.

        .equ DELAY, 1           ; pause between generations (× 2,575 cycles)

gen:    LDI  R0, grid           ; rowp → the row above the current one
        ST   [rowp], R0
        LDI  R0, MATRIX
        ST   [outp], R0
row:    LDI  R0, 0
        ST   [out], R0          ; the new row, built one bit at a time
        LDI  R2, 0x80           ; R2 = the current column's mask
cell:   LDI  R3, 0              ; R3 = neighbours
        LD   R1, [rowp]
        LDR  R0, [R1]           ; the row above: three cells
        CALL three
        INC  R1
        LDR  R0, [R1]           ; this row: the cells either side
        PUSH R0
        CALL two
        INC  R1
        LDR  R0, [R1]           ; the row below: three cells
        CALL three
        POP  R0
        AND  R0, R2             ; alive?
        JZ   rule
        SHR  R3                 ; yes: neighbours OR 1
        SHL  R3
        INC  R3
rule:   LDI  R0, 3
        CMP  R3, R0
        JNZ  next
        LD   R0, [out]          ; the cell lives: set its bit
        OR   R0, R2
        ST   [out], R0
next:   SHR  R2                 ; next column
        JNZ  cell

        LD   R1, [outp]         ; show the new row
        LD   R0, [out]
        STR  [R1], R0
        INC  R1
        ST   [outp], R1
        LD   R0, [rowp]
        INC  R0
        ST   [rowp], R0
        LDI  R0, MATRIX + 8
        CMP  R1, R0
        JNZ  row

        LDI  R1, MATRIX         ; copy the matrix back into grid …
        LDI  R2, grid + 1
        LDI  R3, MATRIX + 8
copy:   LDR  R0, [R1]
        STR  [R2], R0
        INC  R1
        INC  R2
        CMP  R1, R3
        JNZ  copy
        LD   R0, [MATRIX + 7]   ; … with the rows that wrap round
        ST   [grid], R0
        LD   R0, [MATRIX]
        ST   [grid + 9], R0
        CALL delay
        JMP  gen

; three: add to R3 the live cells of row R0 in column R2 and its two neighbours.
; two: the same without the middle cell. Both keep R0 and R2.
three:  CALL test               ; the cell itself
two:    PUSH R0                 ; the right-hand neighbour: rotate the row left
        SHL  R0
        JNC  rot1
        INC  R0                 ; (the bit that fell off the left comes back on the right)
rot1:   CALL test
        POP  R0
        PUSH R2                 ; the left-hand neighbour: rotate the mask left
        SHL  R2
        JNC  rot2
        INC  R2
rot2:   CALL test
        POP  R2
        RET

; test: if R0 AND R2 is not zero, R3 += 1. Keeps R0 (POP leaves the flags alone).
test:   PUSH R0
        AND  R0, R2
        POP  R0
        JZ   dead
        INC  R3
dead:   RET

; delay: wait DELAY × 256 turns of an empty loop. Uses R2 and R3.
delay:  LDI  R2, 0 - DELAY
outer:  LDI  R3, 0
inner:  INC  R3
        JNZ  inner
        INC  R2
        JNZ  outer
        RET

rowp:   .byte 0
outp:   .byte 0
out:    .byte 0
grid:   .byte 0b00000000        ; (row 7 again)
        .byte 0b01000000        ; row 0: a glider
        .byte 0b00100000        ; row 1
        .byte 0b11100000        ; row 2
        .byte 0, 0, 0, 0, 0     ; rows 3–7
        .byte 0b01000000        ; (row 0 again)

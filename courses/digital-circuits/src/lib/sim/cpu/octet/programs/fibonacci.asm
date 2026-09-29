; Fibonacci numbers: 1, 1, 2, 3, 5, 8, … as long as they fit in a byte.
; Each one is stored in the table fib and shown on the hex display.
; Shows: a loop that stops on the carry flag, and a pointer walking through memory.

        LDI  R0, 0              ; a
        LDI  R1, 1              ; b
        LDI  R3, fib            ; where the next number goes
loop:   STR  [R3], R1           ; store b
        ST   [HEX], R1
        INC  R3
        MOV  R2, R1
        ADD  R1, R0             ; b = a + b: C = 1 if it no longer fits
        MOV  R0, R2             ; a = old b (MOV leaves the flags alone)
        JNC  loop
        HLT

fib:    .space 13               ; 1 1 2 3 5 8 13 21 34 55 89 144 233

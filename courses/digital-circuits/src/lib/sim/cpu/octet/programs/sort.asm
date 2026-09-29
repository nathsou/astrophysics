; Sort 8 bytes into ascending order (unsigned), by bubble sort:
; sweep through the list swapping neighbours that are out of order, until a sweep swaps nothing.
; Shows: two pointers, CMP and the carry flag as "less than", and a flag kept in memory.

        .equ LAST, data + 7

sweep:  LDI  R0, 0
        ST   [swapped], R0
        LDI  R1, data           ; R1 → a[i]
pair:   MOV  R3, R1
        INC  R3                 ; R3 → a[i + 1]
        LDR  R0, [R1]
        LDR  R2, [R3]
        CMP  R2, R0             ; a[i + 1] − a[i]: C = 1 if a[i + 1] < a[i]
        JNC  next
        STR  [R1], R2           ; swap them
        STR  [R3], R0
        ST   [swapped], R3      ; any non-zero value means "swapped"
next:   MOV  R1, R3
        LDI  R0, LAST
        CMP  R1, R0
        JNZ  pair
        LD   R0, [swapped]
        OR   R0, R0
        JNZ  sweep
        HLT

swapped: .byte 0
data:   .byte 42, 7, 255, 0, 128, 7, 99, 1

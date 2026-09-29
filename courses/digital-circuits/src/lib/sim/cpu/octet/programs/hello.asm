; Print "HELLO, WORLD" on the console.
; Shows: a string in memory, walked with a pointer until its zero byte.

        LDI  R1, message
loop:   LDR  R0, [R1]           ; the next character
        OR   R0, R0             ; zero? (OR sets Z)
        JZ   done
        ST   [CONSOLE], R0
        INC  R1
        JMP  loop
done:   HLT

message: .string "HELLO, WORLD\n"

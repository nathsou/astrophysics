# Print "HELLO, WORLD" on the console.
# Shows: a string in memory, walked with a pointer until its zero byte.

        la   a1, message
loop:   lbu  a0, 0(a1)          # the next character
        beqz a0, done           # zero ends the string
        sb   a0, CONSOLE(zero)
        addi a1, a1, 1
        j    loop
done:   ebreak

message: .string "HELLO, WORLD\n"

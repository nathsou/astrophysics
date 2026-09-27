.text
.globl _start
_start:
    bl main
    mov x8, #93
    svc #0
.globl print_int
print_int:
    mov x8, #1000
    svc #0
    mov x0, #0
    ret
.globl putchar
putchar:
    mov x8, #1001
    svc #0
    mov x0, #0
    ret

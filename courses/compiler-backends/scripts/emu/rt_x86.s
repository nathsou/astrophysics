.intel_syntax noprefix
.text
.globl _start
_start:
    call main
    mov rdi, rax
    mov eax, 60
    syscall
.globl print_int
print_int:
    mov rax, 1000
    syscall
    xor eax, eax
    ret
.globl putchar
putchar:
    mov rax, 1001
    syscall
    xor eax, eax
    ret

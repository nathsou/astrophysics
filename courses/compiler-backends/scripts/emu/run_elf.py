# Run a static x86-64 or AArch64 Linux ELF under Unicorn with a tiny syscall layer.
import sys, struct
from unicorn import *
from unicorn.x86_const import *
from unicorn.arm64_const import *
data = open(sys.argv[1], 'rb').read()
machine = struct.unpack_from('<H', data, 18)[0]
entry, phoff = struct.unpack_from('<QQ', data, 24)
phnum = struct.unpack_from('<H', data, 56)[0]
arch = 'x86' if machine == 62 else 'a64'
mu = Uc(UC_ARCH_X86, UC_MODE_64) if arch == 'x86' else Uc(UC_ARCH_ARM64, UC_MODE_ARM)
for i in range(phnum):
    p_type, flags, off, vaddr, paddr, filesz, memsz, align = struct.unpack_from('<IIQQQQQQ', data, phoff + 56 * i)
    if p_type != 1: continue
    lo = vaddr & ~0xfff; hi = (vaddr + memsz + 0xfff) & ~0xfff
    try: mu.mem_map(lo, hi - lo)
    except UcError: pass
    mu.mem_write(vaddr, data[off:off + filesz])
STACK = 0x7f000000
mu.mem_map(STACK - 0x100000, 0x100000)
out = []
state = {'exit': None}
if arch == 'x86':
    mu.reg_write(UC_X86_REG_RSP, STACK - 8)
    def hook_syscall(uc, user):
        n = uc.reg_read(UC_X86_REG_RAX); a0 = uc.reg_read(UC_X86_REG_RDI)
        if n == 1000: out.append(str(a0 - (1 << 64) if a0 >> 63 else a0) + '\n')
        elif n == 1001: out.append(chr(a0 & 0xff))
        elif n == 60: state['exit'] = a0; uc.emu_stop()
    mu.hook_add(UC_HOOK_INSN, hook_syscall, None, 1, 0, UC_X86_INS_SYSCALL)
else:
    mu.reg_write(UC_ARM64_REG_SP, STACK - 16)
    def hook_intr(uc, intno, user):
        n = uc.reg_read(UC_ARM64_REG_X8); a0 = uc.reg_read(UC_ARM64_REG_X0)
        if n == 1000: out.append(str(a0 - (1 << 64) if a0 >> 63 else a0) + '\n')
        elif n == 1001: out.append(chr(a0 & 0xff))
        elif n == 93: state['exit'] = a0; uc.emu_stop()
    mu.hook_add(UC_HOOK_INTR, hook_intr)
try:
    mu.emu_start(entry, 0, count=50_000_000)
except UcError as e:
    pc = mu.reg_read(UC_X86_REG_RIP if arch == 'x86' else UC_ARM64_REG_PC)
    print('EMU ERROR', e, hex(pc)); sys.exit(2)
sys.stdout.write(''.join(out)); print('exit=%d' % ((state['exit'] or 0) & 0xff))

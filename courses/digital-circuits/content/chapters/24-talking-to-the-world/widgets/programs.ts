/**
 * The programs of Chapter 24, for the I/O board (`IoBoard.svelte`). Each is assembled and run, with the behaviour the text
 * quotes, in `programs.test.ts`. They use only what `spec.ts` gives Octet: stores and loads at the device addresses, and loops.
 */

export interface BoardProgram {
  id: string;
  title: string;
  summary: string;
  source: string;
  /** Which pins the analyser shows first. */
  show: ('tx' | 'pwm' | 'dac' | 'leds')[];
  /** For the UART program: clock cycles per bit. */
  uartBit?: number;
  /** The devices to show. */
  devices: ('leds' | 'switches' | 'buttons' | 'hex' | 'console')[];
  /** The analyser window in milliseconds. */
  windowMs: number;
}

export const UART_BIT_CYCLES = 104;

export const UART_SOURCE = `; A UART transmitter in software ("bit-banging"): send "Hi!" on LED 0, which is the TX pin.
; One bit lasts 104 clock cycles, so at the board's 1 MHz clock that is 9615 baud.
; The line idles high; a frame is a low start bit, eight data bits (least significant
; first) and a high stop bit. Every store to LEDS must come exactly 104 cycles after the
; last, so the code between stores is padded with NOPs to take the same time on every path.
        LDI  R1, 1
        ST   [LEDS], R1         ; the line idles high
        CALL bit                ; and stays there for a while, so that a receiver
        CALL bit                ; can tell the first start bit from the idle line
        CALL bit
        LDI  R1, message
next:   LDR  R0, [R1]
        OR   R0, R0             ; the zero byte ends the string
        JZ   done
        CALL send
        INC  R1
        JMP  next
done:   HLT

; send: transmit R0. Uses R2 and R3, and keeps R1.
send:   PUSH R1
        LDI  R1, 0
        ST   [LEDS], R1         ; start bit: the line goes low
        NOP                     ; padding: the start bit's path is shorter than a data bit's
        NOP
        NOP
        NOP
        CALL bit                ; hold it for one bit time
        LDI  R2, 8
databit: MOV R1, R0
        LDI  R3, 1
        AND  R1, R3             ; the lowest bit of the data
        ST   [LEDS], R1
        CALL bit
        SHR  R0                 ; the next bit
        LDI  R3, 1
        SUB  R2, R3
        JNZ  databit
        LDI  R3, 0              ; padding
        LDI  R3, 0
        LDI  R1, 1
        ST   [LEDS], R1         ; stop bit: back to idle
        CALL bit
        POP  R1
        RET

; bit: wait, so that the stores to LEDS are 104 cycles apart.
bit:    LDI  R3, 252            ; 4 turns of a 10-cycle loop, counting up to zero
wait:   INC  R3
        JNZ  wait
        NOP
        RET

message: .string "Hi!"
`;

export const PWM_FADE_SOURCE = `; Breathe: raise the PWM duty from 0 to 255 and back, a step at a time.
; The PWM register holds n; the pin is high for n of every 256 clock cycles.
        LDI  R0, 0              ; the duty
        LDI  R2, 1              ; the step: +1, or 255 (= -1)
loop:   ST   [PWM], R0
        ST   [LEDS], R0         ; show it on the LEDs too
        CALL pause
        ADD  R0, R2
        LDI  R3, 255
        CMP  R0, R3
        JNZ  notmax
        LDI  R2, 255            ; at the top: count down
        JMP  loop
notmax: OR   R0, R0
        JNZ  loop
        LDI  R2, 1              ; at the bottom: count up
        JMP  loop

; pause: about 500 cycles
pause:  LDI  R3, 206
p1:     INC  R3
        JNZ  p1
        RET
`;

export const TRIANGLE_SOURCE = `; A triangle wave on the DAC: count up 0 to 255, then down, writing every value.
; Each store is one step of the staircase; the DAC output is n/256 of 5 V.
        LDI  R0, 0
up:     ST   [DAC], R0
        INC  R0
        JNZ  up                 ; 255 + 1 wraps to 0: the top is reached
        LDI  R0, 255
down:   ST   [DAC], R0
        LDI  R3, 1
        SUB  R0, R3
        JNZ  down
        JMP  up
`;

export const COUNT_NAIVE_SOURCE = `; Count presses of BTN0, the obvious way: every time the button reads 1 after a 0,
; that is a press. With a real, bouncing switch it counts the bounces too.
        LDI  R0, 0              ; the count
        LDI  R1, 0              ; the last state of the button
        LDI  R2, 1
poll:   LD   R3, [BUTTONS]
        AND  R3, R2             ; BTN0 alone
        CMP  R3, R1
        JZ   poll               ; no change
        MOV  R1, R3
        OR   R3, R3
        JZ   poll               ; it was released
        INC  R0                 ; a rising edge: count it
        ST   [HEX], R0
        JMP  poll
`;

export const COUNT_DEBOUNCED_SOURCE = `; The same, with debouncing: after an edge, look away for about 10 ms (10,000 cycles at
; 1 MHz), longer than any bounce, and only then look at the button again.
        LDI  R0, 0
        LDI  R1, 0
        LDI  R2, 1
poll:   LD   R3, [BUTTONS]
        AND  R3, R2
        CMP  R3, R1
        JZ   poll
        MOV  R1, R3
        CALL settle             ; ignore the button while the contacts bounce
        OR   R3, R3
        JZ   poll
        INC  R0
        ST   [HEX], R0
        JMP  poll

; settle: wait about 10,000 cycles, keeping R2 and R3.
settle: PUSH R2
        PUSH R3
        LDI  R3, 252            ; four turns of the outer loop: 252, 253, 254, 255, then 0
outer:  LDI  R2, 0
inner:  INC  R2
        JNZ  inner              ; 256 turns of 10 cycles = 2,560 cycles
        INC  R3
        JNZ  outer
        POP  R3
        POP  R2
        RET
`;

export const SAR_SOURCE = `; A successive-approximation ADC in software. The board has a DAC (write 0xFF) and a
; comparator (bit 7 of BUTTONS, 1 when the analogue input is above the DAC's output).
; Try the top bit; if the input is still above the DAC, keep the bit; then the next bit.
        LDI  R0, 0              ; the result so far
        LDI  R1, 0x80           ; the bit being tried
try:    MOV  R2, R0
        OR   R2, R1             ; the trial value
        ST   [DAC], R2
        LD   R3, [BUTTONS]
        OR   R3, R3             ; N = bit 7 = the comparator
        JNN  next               ; below the DAC: drop the bit
        MOV  R0, R2             ; above it: keep the bit
next:   SHR  R1
        JNZ  try
        ST   [DAC], R0          ; the comparator means adc > dac, so the search ends one
        LD   R3, [BUTTONS]      ; short of an exact match: one last comparison
        OR   R3, R3
        JNN  done
        INC  R0
done:   ST   [HEX], R0
        ST   [LEDS], R0
        HLT
`;

export const ECHO_SWITCHES_SOURCE = `; Copy the switches to the LEDs, over and over. Reading a device is a load, writing one is a store.
loop:   LD   R0, [SWITCHES]
        ST   [LEDS], R0
        JMP  loop
`;

export const BOARD_PROGRAMS: BoardProgram[] = [
  { id: 'uart', title: 'UART: "Hi!" on LED 0', summary: 'A software UART: the analyser decodes the frames.', source: UART_SOURCE, show: ['tx'], uartBit: UART_BIT_CYCLES, devices: ['leds'], windowMs: 4.5 },
  { id: 'pwm-fade', title: 'PWM: breathe', summary: 'Ramp the duty up and down; the LED follows the average.', source: PWM_FADE_SOURCE, show: ['pwm'], devices: ['leds'], windowMs: 1.5 },
  { id: 'triangle', title: 'DAC: a triangle wave', summary: 'Write 0–255–0 to the DAC; see the staircase.', source: TRIANGLE_SOURCE, show: ['dac'], devices: [], windowMs: 12 },
  { id: 'count-naive', title: 'Count presses (naive)', summary: 'BTN0 bounces; the count is wrong.', source: COUNT_NAIVE_SOURCE, show: ['leds'], devices: ['buttons', 'hex'], windowMs: 8 },
  { id: 'count-debounced', title: 'Count presses (debounced)', summary: 'Look away for 10 ms after an edge.', source: COUNT_DEBOUNCED_SOURCE, show: ['leds'], devices: ['buttons', 'hex'], windowMs: 8 },
  { id: 'sar', title: 'ADC by successive approximation', summary: 'A binary search with the DAC and the comparator.', source: SAR_SOURCE, show: ['dac'], devices: ['hex', 'leds'], windowMs: 0.5 },
  { id: 'switches', title: 'Switches to LEDs', summary: 'Polling: load, store, repeat.', source: ECHO_SWITCHES_SOURCE, show: ['leds'], devices: ['switches', 'leds'], windowMs: 1 },
];

export const boardProgram = (id: string): BoardProgram => {
  const p = BOARD_PROGRAMS.find((x) => x.id === id);
  if (!p) throw new Error(`no board program '${id}'`);
  return p;
};

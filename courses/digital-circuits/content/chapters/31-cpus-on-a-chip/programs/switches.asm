; The LEDs copy the switches. The hex display shows the switches plus the buttons.
; Shows: reading two input devices, and adding them.

loop:   LD   R0, [SWITCHES]
        ST   [LEDS], R0
        LD   R1, [BUTTONS]
        ADD  R1, R0
        ST   [HEX], R1
        JMP  loop

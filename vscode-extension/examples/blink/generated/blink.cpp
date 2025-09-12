#include "blink.h"
#include "Arduino.h"

uint16_t delayMs;

void Blink_setup(uint16_t delayInMs) {
    delayMs = delayInMs;
    pinMode(LED_BUILTIN, OUTPUT);
}

void Blink_loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_BUILTIN, LOW);
    delay(delayMs);
}


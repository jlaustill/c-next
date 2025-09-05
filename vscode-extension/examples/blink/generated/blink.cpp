#include "blink.h"
#include "Arduino.h"

void Blink_setup() {
    pinMode(LED_BUILTIN, OUTPUT);
    Serial.begin(115200);
}

void Blink_loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_BUILTIN, LOW);
    delay(delayMs);
}


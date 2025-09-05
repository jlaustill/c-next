#include "Arduino.h"
#include "blink.h"

void setup() {
    Serial.begin(115200);
    Blink_setup();
}

void loop() {
    Blink_loop();
}


#include "Arduino.h"
#include "blink.h"

void setup() {
    Serial.begin(115200);
    Blink_setup(1000);
}

void loop() {
    Serial.println("Loopy Loop! " + String(micros()));
    Blink_loop();
}


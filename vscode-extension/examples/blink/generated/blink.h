#ifndef BLINK_H
#define BLINK_H

#include <stdint.h>
#include "Arduino.h"

extern uint16_t delayMs;
void Blink_setup(uint16_t delayInMs);
void Blink_loop();

#endif

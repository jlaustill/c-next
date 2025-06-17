// Arduino.h - Core Arduino functions for c-next testing
#ifndef ARDUINO_H
#define ARDUINO_H

#include <stdint.h>

// Pin modes
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2

// Digital pin states
#define LOW 0
#define HIGH 1

// Built-in LED pin
#define LED_BUILTIN 13

// Core Arduino functions
void pinMode(uint8_t pin, uint8_t mode);
void digitalWrite(uint8_t pin, uint8_t value);
int digitalRead(uint8_t pin);
int analogRead(uint8_t pin);
void analogWrite(uint8_t pin, int value);

// Timing functions
void delay(unsigned long ms);
void delayMicroseconds(unsigned int us);
unsigned long millis(void);
unsigned long micros(void);

// Serial communication
typedef struct {
    void (*begin)(long baud);
    void (*print)(const char* str);
    void (*println)(const char* str);
    int (*available)(void);
    int (*read)(void);
} SerialClass;

extern SerialClass Serial;

// Setup and loop (for reference - these are typically defined by user)
void setup(void);
void loop(void);

#endif
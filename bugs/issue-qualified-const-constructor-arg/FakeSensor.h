#pragma once
class FakeSensor {
public:
    FakeSensor(int csPin);
    bool begin(void);
};

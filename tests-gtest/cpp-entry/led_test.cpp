/**
 * GTest wrapper for LED scope tests
 *
 * Tests the C/C++ entry point workflow by verifying the transpiled
 * C-Next code works correctly when called from C++.
 */
#include <gtest/gtest.h>

// Include the generated C-Next header
extern "C" {
#include "led.test.h"
}

// Test fixture to reset state between tests
class LEDTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Ensure LED is off before each test
        LED_off();
    }
};

TEST_F(LEDTest, InitialStateIsOff) {
    // After SetUp, state should be 0
    EXPECT_EQ(LED_getState(), 0);
}

TEST_F(LEDTest, TurnOn) {
    LED_on();
    EXPECT_EQ(LED_getState(), 1);
}

TEST_F(LEDTest, TurnOff) {
    LED_on();
    EXPECT_EQ(LED_getState(), 1);

    LED_off();
    EXPECT_EQ(LED_getState(), 0);
}

TEST_F(LEDTest, Toggle) {
    // Start off, toggle to on
    LED_toggle();
    EXPECT_EQ(LED_getState(), 1);

    // Toggle back to off
    LED_toggle();
    EXPECT_EQ(LED_getState(), 0);

    // Toggle to on again
    LED_toggle();
    EXPECT_EQ(LED_getState(), 1);
}

TEST_F(LEDTest, MultipleOperations) {
    // Sequence of operations
    LED_on();
    LED_on();  // Should stay on
    EXPECT_EQ(LED_getState(), 1);

    LED_off();
    LED_off();  // Should stay off
    EXPECT_EQ(LED_getState(), 0);
}

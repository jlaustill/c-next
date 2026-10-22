/**
 * GTest wrapper for LED scope tests
 *
 * Tests the C/C++ entry point workflow by verifying the transpiled
 * cnx code works correctly when called from C++.
 */
#include <gtest/gtest.h>

// Include the generated cnx header
extern "C" {
#include "led.test.h"
}

// Test fixture to reset state between tests
class LEDTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Ensure LED is off before each test
        LED__off();
    }
};

TEST_F(LEDTest, InitialStateIsOff) {
    // After SetUp, state should be 0
    EXPECT_EQ(LED__getState(), 0);
}

TEST_F(LEDTest, TurnOn) {
    LED__on();
    EXPECT_EQ(LED__getState(), 1);
}

TEST_F(LEDTest, TurnOff) {
    LED__on();
    EXPECT_EQ(LED__getState(), 1);

    LED__off();
    EXPECT_EQ(LED__getState(), 0);
}

TEST_F(LEDTest, Toggle) {
    // Start off, toggle to on
    LED__toggle();
    EXPECT_EQ(LED__getState(), 1);

    // Toggle back to off
    LED__toggle();
    EXPECT_EQ(LED__getState(), 0);

    // Toggle to on again
    LED__toggle();
    EXPECT_EQ(LED__getState(), 1);
}

TEST_F(LEDTest, MultipleOperations) {
    // Sequence of operations
    LED__on();
    LED__on();  // Should stay on
    EXPECT_EQ(LED__getState(), 1);

    LED__off();
    LED__off();  // Should stay off
    EXPECT_EQ(LED__getState(), 0);
}

// Helper (not a test): C++ declarations the #1668 foreign-operand fixture
// combines with a C-Next integer in --cpp mode. Not defined -- the fixture is a
// test-error and never links.
#pragma once

extern float apiScaleCpp;

float apiHalfCpp();

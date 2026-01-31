// Stub implementations for comprehensive-cpp.hpp
// Required for linking tests (not execution)

#include "comprehensive-cpp.hpp"

// ============================================================================
// SECTION 1: NAMESPACES
// ============================================================================
namespace hw {
    void init() {}
    void shutdown() {}

    namespace nested {
        void configure() {}
    }
}

namespace utils {
    int clamp(int val, int min, int max) {
        if (val < min) return min;
        if (val > max) return max;
        return val;
    }
}

// ============================================================================
// SECTION 3: CLASSES WITH STATIC METHODS
// ============================================================================
int CommandHandler::_status = 0;
CommandHandler* CommandHandler::_instance = nullptr;

bool CommandHandler::execute(uint8_t cmd) { return cmd != 0; }
int CommandHandler::getStatus() { return _status; }
void CommandHandler::reset() { _status = 0; }
CommandHandler* CommandHandler::getInstance() {
    if (!_instance) _instance = new CommandHandler();
    return _instance;
}
CommandHandler::StatusInfo CommandHandler::getStatusInfo() {
    return StatusInfo{_status, true};
}

int MathUtils::abs(int x) { return x < 0 ? -x : x; }
int MathUtils::min(int a, int b) { return a < b ? a : b; }
int MathUtils::max(int a, int b) { return a > b ? a : b; }
EMode MathUtils::computeMode(uint8_t flags) {
    return flags == 0 ? EMode::OFF : EMode::ON;
}

// ============================================================================
// SECTION 4: STRUCTS WITH CONSTRUCTORS
// ============================================================================
Result Result::success() { return Result(0, "OK"); }
Result Result::error(int code) { return Result(code, "Error"); }

// ============================================================================
// SECTION 5: TEMPLATES
// ============================================================================
template<typename T, int SIZE>
void Buffer<T, SIZE>::clear() {
    for (int i = 0; i < SIZE; ++i) data[i] = T{};
}

template<typename T, int SIZE>
T& Buffer<T, SIZE>::get(int idx) { return data[idx]; }

template<typename T, int SIZE>
void Buffer<T, SIZE>::set(int idx, T val) { data[idx] = val; }

template<int A, int B, int C>
void TripleParam<A, B, C>::init() {}

template<int A, int B, int C>
void TripleParam<A, B, C>::begin() {}

template<int A, int B, int C>
void TripleParam<A, B, C>::end() {}

template<int BUS, int RX_SIZE, int TX_SIZE>
void FlexCAN_T4<BUS, RX_SIZE, TX_SIZE>::begin() {}

template<int BUS, int RX_SIZE, int TX_SIZE>
void FlexCAN_T4<BUS, RX_SIZE, TX_SIZE>::end() {}

template<int BUS, int RX_SIZE, int TX_SIZE>
bool FlexCAN_T4<BUS, RX_SIZE, TX_SIZE>::write(uint32_t, const uint8_t*, uint8_t) { return true; }

template<int BUS, int RX_SIZE, int TX_SIZE>
bool FlexCAN_T4<BUS, RX_SIZE, TX_SIZE>::read(uint32_t&, uint8_t*, uint8_t&) { return false; }

// Explicit instantiations
template class Buffer<uint8_t, 32>;
template class Buffer<uint8_t, 64>;
template class Buffer<uint8_t, 256>;
template class TripleParam<1, 2, 3>;
template class FlexCAN_T4<CAN1, RX_SIZE_256, TX_SIZE_16>;
template class FlexCAN_T4<CAN2, RX_SIZE_256, TX_SIZE_16>;

// ============================================================================
// SECTION 6: INHERITANCE
// ============================================================================
void Base::process() {}
int Base::getValue() const { return value; }

void Derived::process() { Base::process(); }
int Derived::getValue() const { return value + extraValue; }
void Derived::extra() {}

// ============================================================================
// SECTION 7: NESTED TYPES
// ============================================================================
Outer::InnerStruct Outer::create() { return InnerStruct{0, InnerEnum::X}; }
Outer::InnerEnum Outer::getDefaultType() { return InnerEnum::X; }
void Outer::process(InnerEnum, const InnerStruct&) {}

// ============================================================================
// SECTION 8: CONSTEXPR CONSTANTS
// ============================================================================
const char* const APP_NAME = "CppInteropTest";
const char* const VERSION_STRING = "1.0.0";

// ============================================================================
// SECTION 9: FUNCTION OVERLOADS
// ============================================================================
int process(int x) { return x; }
int process(int x, int y) { return x + y; }
float process(float x) { return x; }
double process(double x) { return x; }
Result process(const char*) { return Result(0); }

// ============================================================================
// SECTION 10: REFERENCES AND POINTERS
// ============================================================================
void modifyRef(int& ref) { ref = 0; }
void readRef(const int&) {}
void modifyPtr(int* ptr) { if (ptr) *ptr = 0; }
void readPtr(const int*) {}

// ============================================================================
// SECTION 12: SINGLETON AND STATIC MEMBERS
// ============================================================================
int Registry::handlerCount = 0;

Singleton& Singleton::instance() {
    static Singleton s;
    return s;
}

void Registry::registerHandler(int, void(*)()) { ++handlerCount; }
void Registry::unregisterHandler(int) { if (handlerCount > 0) --handlerCount; }
void Registry::callHandler(int) {}
int Registry::getHandlerCount() { return handlerCount; }

// ============================================================================
// SECTION 13: CALLBACKS
// ============================================================================
void registerCallback(Callback) {}
void registerIntCallback(IntCallback) {}
void registerResultCallback(ResultCallback) {}
void registerResultPtrCallback(ResultPtrCallback) {}

// ============================================================================
// SECTION 14: OPERATOR OVERLOADING
// ============================================================================
Vector2 Vector2::operator+(const Vector2& other) const { return {x + other.x, y + other.y}; }
Vector2 Vector2::operator-(const Vector2& other) const { return {x - other.x, y - other.y}; }
Vector2 Vector2::operator*(float scalar) const { return {x * scalar, y * scalar}; }
bool Vector2::operator==(const Vector2& other) const { return x == other.x && y == other.y; }
bool Vector2::operator!=(const Vector2& other) const { return !(*this == other); }

// ============================================================================
// SECTION 15: EXPLICIT CONSTRUCTORS
// ============================================================================
ExplicitType::ExplicitType(int val) : value(val) {}
ExplicitType::operator bool() const { return value != 0; }
ExplicitType::operator int() const { return value; }

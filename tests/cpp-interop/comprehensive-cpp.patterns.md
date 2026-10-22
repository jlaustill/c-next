// Expected C++ Output Patterns for comprehensive-cpp.test.cnx
// This file documents what the transpiled code SHOULD generate
// Used for validation after implementing fixes

// =============================================================================
// SECTION 1: NAMESPACE ACCESS
// =============================================================================
// cnx: global.hw.init()
// Expected C++ (NOT hw_init):
hw::init();
hw::shutdown();

// cnx: global.hw.VERSION
// Expected C++ (NOT hw_VERSION):
int32_t ver = hw::VERSION;
int32_t maxDev = hw::MAX_DEVICES;

// cnx: global.hw.nested.configure()
// Expected C++ (NOT hw_nested_configure):
hw::nested::configure();
int32_t bufSize = hw::nested::BUFFER_SIZE;

// cnx: global.utils.clamp(50, 0, 100)
// Expected C++:
int32_t val = utils::clamp(50, 0, 100);

// =============================================================================
// SECTION 2: ENUM ACCESS
// =============================================================================
// cnx: global.EMode.ON
// Expected C++ (NOT EMode_ON for enum class):
EMode mode1 = EMode::OFF;
EMode mode2 = EMode::ON;
EMode mode3 = EMode::AUTO;
EMode mode4 = EMode::MANUAL;

// cnx: global.EColor.RED
// Expected C++ (enum class without underlying):
EColor color1 = EColor::RED;
EColor color2 = EColor::GREEN;
EColor color3 = EColor::BLUE;

// cnx: FLAG_READ (typed enum, not class - C-style is OK)
// Expected C++ (either style valid):
EFlags flags1 = FLAG_NONE;
EFlags flags2 = FLAG_READ;
// OR: EFlags flags2 = EFlags::FLAG_READ;

// cnx: LEGACY_A (C-style enum)
// Expected C++:
ELegacy leg1 = LEGACY_A;

// =============================================================================
// SECTION 3: STATIC METHODS
// =============================================================================
// cnx: global.CommandHandler.execute(1)
// Expected C++ (NOT CommandHandler_execute or CommandHandler.execute):
bool ok = CommandHandler::execute(1);
int32_t status = CommandHandler::getStatus();
CommandHandler::reset();

// cnx: global.CommandHandler.getInstance()
// Expected C++:
CommandHandler\* instance = CommandHandler::getInstance();

// cnx: global.CommandHandler.getStatusInfo()
// Expected C++:
CommandHandler::StatusInfo info = CommandHandler::getStatusInfo();

// cnx: global.MathUtils.abs(-5)
// Expected C++:
int32_t absVal = MathUtils::abs(-5);
int32_t minVal = MathUtils::min(10, 20);
int32_t maxVal = MathUtils::max(10, 20);
int32_t pi = MathUtils::PI_INT;

// =============================================================================
// SECTION 4: STRUCT INITIALIZATION
// =============================================================================
// cnx: Result r1;
// Expected C++ (NOT = 0 or {0} for non-trivial types):
Result r1{}; // Value initialization
// OR: Result r1; // Default initialization (calls constructor)

// cnx: global.Result(42)
// Expected C++:
Result r2 = Result(42);

// cnx: global.Result.success()
// Expected C++:
Result success = Result::success();
Result error = Result::error(404);

// POD struct (trivial - can use {0} or {}):
Point p{};
p.x = 10;

// =============================================================================
// SECTION 5: TEMPLATES
// =============================================================================
// NOTE: Template support is limited in current implementation
// These patterns show expected output IF templates are supported

// cnx: Buffer<u8, 32> smallBuf;
// Expected C++:
Buffer<uint8_t, 32> smallBuf{};
smallBuf.clear();
uint8_t byte = smallBuf.get(0);

// cnx: global.Buffer<u8, 32>.capacity()
// Expected C++ (static method on template):
int32_t cap = Buffer<uint8_t, 32>::capacity();

// cnx: FlexCAN_T4<global.CAN1, global.RX_SIZE_256, global.TX_SIZE_16>
// Expected C++:
FlexCAN_T4<CAN1, RX_SIZE_256, TX_SIZE_16> canBus{};

// =============================================================================
// SECTION 6: CONSTEXPR CONSTANTS
// =============================================================================
// cnx: global.MAX_SIZE
// Expected C++ (constexpr at namespace level):
int32_t maxSize = MAX_SIZE;
int32_t minSize = MIN_SIZE;
uint32_t magic = MAGIC_NUMBER;

// cnx: global.square(5)
// Expected C++ (constexpr function):
int32_t sq = square(5);
int32_t fact = factorial(5);

// =============================================================================
// SECTION 7: NESTED TYPES
// =============================================================================
// cnx: global.Outer.InnerEnum.X
// Expected C++:
Outer::InnerEnum e1 = Outer::InnerEnum::X;
Outer::InnerEnum e2 = Outer::InnerEnum::Y;

// cnx: global.Outer.create()
// Expected C++:
Outer::InnerStruct s = Outer::create();

// =============================================================================
// SECTION 8: TYPE CONVERSIONS (Issue #252)
// =============================================================================
// cnx: processByte(crc, cfg.enabled) // bool → u8
// Expected C++ (temp variable with cast):
uint8_t \_cnx_tmp_0 = static_cast<uint8_t>(cfg.enabled);
crc = processByte(crc, \_cnx_tmp_0);

// cnx: processByte(crc, cfg.mode) // enum → u8
// Expected C++:
uint8_t \_cnx_tmp_1 = static_cast<uint8_t>(cfg.mode);
crc = processByte(crc, \_cnx_tmp_1);

// =============================================================================
// SECTION 9: ARRAY MEMBER ACCESS (Issue #256 / #304)
// =============================================================================
// cnx: device.sensors[0].enabled
// Expected C++ (direct access, no spurious &):
bool enabled = device.sensors[0].enabled;
EMode mode = device.sensors[1].mode;

// When passing to function expecting different type:
uint8_t \_cnx_tmp_2 = static_cast<uint8_t>(device.sensors[0].enabled);
crc = processByte(crc, \_cnx_tmp_2);

// =============================================================================
// SECTION 10: SINGLETON ACCESS
// =============================================================================
// cnx: global.Singleton.instance()
// Expected C++:
Singleton& inst = Singleton::instance();
int32_t val = inst.getValue();
inst.setValue(42);

// cnx: global.Registry.registerHandler(1, null)
// Expected C++ (nullptr for C++):
Registry::registerHandler(1, nullptr);
Registry::callHandler(1);
int32_t count = Registry::getHandlerCount();

// =============================================================================
// SECTION 15: CALLBACK INTEROP (Issue #409)
// =============================================================================
// cnx: void simpleCallback() { }
// Expected C++:
void simpleCallback(void) { }

// cnx: global.registerCallback(simpleCallback)
// Expected C++ (function name decays to function pointer):
registerCallback(simpleCallback);

// cnx: void intCallback(i32 value) { }
// Expected C++:
void intCallback(int32_t value) { }

// cnx: global.registerIntCallback(intCallback)
// Expected C++:
registerIntCallback(intCallback);

// NOTE: cnx 'const T' struct params become 'const T\*' (pointer),
// NOT 'const T&' (reference). Use pointer-based callbacks for struct params.

// cnx: void resultCallback(const Result result) { }
// Expected C++ (pointer, NOT reference):
void resultCallback(const Result\* result) { }

// cnx: global.registerResultPtrCallback(resultCallback)
// Expected C++ (requires pointer-based callback typedef):
registerResultPtrCallback(resultCallback);

// =============================================================================
// VALIDATION PATTERNS (grep/regex)
// =============================================================================
// These patterns can be used to validate correct output:
//
// SHOULD EXIST (use grep -E):
// hw::init
// hw::nested::
// EMode::OFF
// EColor::RED
// CommandHandler::execute
// CommandHandler::getStatus
// MathUtils::abs
// Result::success
// Outer::InnerEnum::X
// Outer::InnerStruct
// Registry::
// Singleton::instance
// static*cast<uint8_t>
//
// SHOULD NOT EXIST (use grep -v or expect empty):
// hw_init (underscore for C++ namespace)
// EMode_OFF (underscore for enum class)
// CommandHandler* (underscore for class static)
// = 0;.*Result (= 0 for non-trivial types)
// {0}.*Result ({0} for non-trivial types)

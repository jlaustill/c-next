#ifndef CALLBACK_C_HEADER_PARAMS_H
#define CALLBACK_C_HEADER_PARAMS_H
#include <stdint.h>
#include <stdbool.h>
typedef struct Sample {
    int32_t value;
} Sample;
void onValue(uint32_t v);
void onMut(uint32_t *v);
void onSample(const Sample *s);
void onMutSample(Sample *s);
void onBytes(const uint8_t bytes[4]);
void onText(const char *text);
float onMix(double d, bool b, int8_t i);
typedef Sample *SampleRef;
typedef uint32_t *U32Ref;
void onMutSampleRef(SampleRef s);
void onMutRef(U32Ref v);
void onTick(uint32_t (*t)(void));
typedef uint32_t (*clock_fn)(void);
void onClockFn(clock_fn t);
void onGrid(const uint8_t g[4][4]);
void onGrid48(const uint8_t g[4][8]);
uint_least32_t leastClock(void);
typedef const uint8_t CByte;
void onCBytes(CByte *b);
void onVolatile(volatile uint32_t *v);
typedef const uint8_t *CBytePtr;
typedef const char *cstr_t;
void onCBytePtr(CBytePtr b);
void onName(cstr_t n);
typedef const uint32_t *CU32Ptr;
void onCU32(CU32Ptr v);
typedef struct {
    uint32_t v;
} nonvolatile_cfg_t;
typedef struct {
    uint32_t v;
} constraint_t;
void onCfg(nonvolatile_cfg_t *c);
void onCons(constraint_t *c);
typedef uint8_t mac_t[6];
void onMacs(const mac_t macs[2]);
void onMacPtr(const mac_t *macs);
void legacySink();
#endif

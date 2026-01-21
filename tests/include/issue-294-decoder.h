#ifndef ISSUE_294_DECODER_H
#define ISSUE_294_DECODER_H

/**
 * Issue #294: Header for decoder scope
 * Provides function declarations for cross-file scope test
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* decoder scope public functions */
uint16_t decoder_getSpn(const uint8_t data[8]);
uint8_t decoder_getByte(const uint8_t data[8], uint8_t index);

#ifdef __cplusplus
}
#endif

#endif /* ISSUE_294_DECODER_H */

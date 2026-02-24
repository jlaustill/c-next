/**
 * Issue #957: ESP-IDF style handle - NO struct definition visible
 *
 * This is the exact pattern used by ESP-IDF where the struct is
 * defined elsewhere (in the .c file, not the header).
 */
#ifndef ESP_STYLE_H
#define ESP_STYLE_H

#include <stdint.h>
#include <stdbool.h>

/* ESP-IDF single-line handle pattern - struct is NEVER defined in header */
typedef struct spi_device_t *spi_device_handle_t;

/* API functions */
bool spi_device_init(spi_device_handle_t *out_handle);
void spi_device_write(spi_device_handle_t handle, uint8_t data);

#endif /* ESP_STYLE_H */

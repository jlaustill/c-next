/**
 * C header with anonymous struct/union patterns common in embedded libraries.
 * Inspired by ESP-IDF, STM32 HAL, and other embedded C libraries.
 */

#ifndef ANON_TYPES_H
#define ANON_TYPES_H

#include <stdint.h>
#include <stdbool.h>

/* Pattern 1: Simple anonymous struct field (issue #882) */
typedef struct {
    int value;
    struct {
        unsigned int flag_a: 1;
        unsigned int flag_b: 1;
        unsigned int reserved: 30;
    } flags;
} SimpleConfig;

/* Pattern 2: Anonymous struct with multiple typed fields */
typedef struct {
    struct {
        uint16_t width;
        uint16_t height;
    } resolution;
    struct {
        uint8_t brightness;
        uint8_t contrast;
    } settings;
} DisplayConfig;

/* Pattern 3: Nested anonymous structs */
typedef struct {
    struct {
        struct {
            uint8_t r;
            uint8_t g;
            uint8_t b;
        } foreground;
        struct {
            uint8_t r;
            uint8_t g;
            uint8_t b;
        } background;
    } colors;
} ThemeConfig;

/* Pattern 4: Anonymous union inside struct */
typedef struct {
    int type;
    union {
        int32_t int_val;
        float float_val;
        struct {
            uint16_t x;
            uint16_t y;
        } point;
    } data;
} Variant;

/* Pattern 5: ESP-IDF style - deeply nested with bitfields */
typedef struct {
    int clk_src;
    struct {
        unsigned int pclk_hz;
        unsigned int h_res;
        unsigned int v_res;
    } timings;
    struct {
        unsigned int fb_in_psram: 1;
        unsigned int double_fb: 1;
        unsigned int no_fb: 1;
        unsigned int bb_invalidate_cache: 1;
    } flags;
} PanelConfig;

/* Pattern 6: Function taking struct with anonymous member */
void configure_simple(SimpleConfig cfg);
void configure_display(DisplayConfig cfg);
void configure_panel(PanelConfig cfg);

/* Pattern 7: Function returning struct with anonymous member */
SimpleConfig get_default_simple(void);
DisplayConfig get_default_display(void);

/* Pattern 8: Callback typedef with struct parameter containing anonymous member */
typedef void (*ConfigCallback)(SimpleConfig cfg);
typedef void (*DisplayCallback)(DisplayConfig cfg);

/* Pattern 9: Struct containing callback that takes struct with anonymous member */
typedef struct {
    ConfigCallback on_config;
    DisplayCallback on_display;
    void* user_data;
} EventHandlers;

#endif /* ANON_TYPES_H */

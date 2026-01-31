/**
 * Debug: Find the correct RMT clock enable bit
 */

#include <stdio.h>
#include <stdint.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define REG(addr) (*(volatile uint32_t*)(addr))

void test_clock_bit(int bit) {
    printf("\nTesting PERIP_CLK_EN0 bit %d:\n", bit);

    // Clear the bit first
    REG(0x600C0018) &= ~(1 << bit);

    // Clear RMT reset if there is one
    REG(0x600C0024) &= ~(1 << bit);

    // Read RMT_SYS_CONF before
    uint32_t before = REG(0x600160C0);

    // Set the clock bit
    REG(0x600C0018) |= (1 << bit);

    // Try writing to RMT_SYS_CONF
    REG(0x600160C0) = 0x05040001;

    // Read back
    uint32_t after = REG(0x600160C0);

    printf("  Before write: RMT_SYS_CONF = 0x%08lx\n", before);
    printf("  After write:  RMT_SYS_CONF = 0x%08lx\n", after);

    if (after == 0x05040001) {
        printf("  *** BIT %d WORKS! ***\n", bit);
    }
}

void app_main(void)
{
    printf("\n\n========================================\n");
    printf("RMT Clock Bit Discovery\n");
    printf("========================================\n");

    printf("\nCurrent PERIP_CLK_EN0 = 0x%08lx\n", REG(0x600C0018));
    printf("Current PERIP_RST_EN0 = 0x%08lx\n", REG(0x600C0024));

    // Test various bits that might control RMT
    for (int bit = 0; bit < 16; bit++) {
        test_clock_bit(bit);
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    printf("\n\nDone testing. Now let's try with the ESP-IDF approach...\n");

    // Let's see what ESP-IDF does - it likely uses a different API
    // The HAL layer might use different registers

    printf("\nChecking HP_SYS_CLKRST registers (0x60096000):\n");
    printf("  HP_SYS_CLKRST_PERI_CLK_CTRL20 @ 0x60096058 = 0x%08lx\n", REG(0x60096058));
    printf("  HP_SYS_CLKRST_PERI_CLK_CTRL21 @ 0x6009605C = 0x%08lx\n", REG(0x6009605C));

    printf("\nEntering idle...\n");
    while(1) {
        vTaskDelay(pdMS_TO_TICKS(5000));
        printf(".\n");
    }
}

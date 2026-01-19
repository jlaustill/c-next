#include <stdio.h>

char line[256];

void readFile() {
    FILE* c_file = fopen("data.txt", "r");
    if (c_file != NULL) {
        while (fgets(line, sizeof(line), c_file) != NULL) {
            printf("%s", line);
        }
        fclose(c_file);
    }
}

#include "cjson_api.h"
#include <string.h>

cJSON* cjson_api_parse(const char* text) {
    return cJSON_Parse(text);
}

cJSON* cjson_api_create_array(void) {
    return cJSON_CreateArray();
}

/* int32_t is not int on newlib or avr-libc (#1764), so each element crosses
   the boundary as a number rather than the array as an int* */
cJSON* cjson_api_create_int_array(const int32_t* numbers, int32_t count) {
    cJSON* array = cJSON_CreateArray();
    for (int32_t i = 0; (array != NULL) && (i < count); i++) {
        cJSON* item = cJSON_CreateNumber((double)numbers[i]);
        if ((item == NULL) || !cJSON_AddItemToArray(array, item)) {
            cJSON_Delete(item);
            cJSON_Delete(array);
            array = NULL;
        }
    }
    return array;
}

cJSON* cjson_api_create_object(void) {
    return cJSON_CreateObject();
}

cJSON* cjson_api_create_number(double value) {
    return cJSON_CreateNumber(value);
}

cJSON* cjson_api_create_string(const char* value) {
    return cJSON_CreateString(value);
}

char* cjson_api_print_unformatted(const cJSON* item) {
    return cJSON_PrintUnformatted(item);
}

void cjson_api_delete(cJSON* item) {
    cJSON_Delete(item);
}

void cjson_api_free_string(char* text) {
    cJSON_free(text);
}

int cjson_api_get_array_size(const cJSON* array) {
    return cJSON_GetArraySize(array);
}

cJSON* cjson_api_get_array_item(const cJSON* array, int index) {
    return cJSON_GetArrayItem(array, index);
}

cJSON* cjson_api_get_object_item(const cJSON* object, const char* key) {
    return cJSON_GetObjectItemCaseSensitive(object, key);
}

int cjson_api_add_item_to_array(cJSON* array, cJSON* item) {
    return cJSON_AddItemToArray(array, item);
}

int cjson_api_add_item_to_object(cJSON* object, const char* key, cJSON* item) {
    return cJSON_AddItemToObject(object, key, item);
}

int cjson_api_is_number(const cJSON* item) {
    return cJSON_IsNumber(item);
}

int cjson_api_is_string(const cJSON* item) {
    return cJSON_IsString(item);
}

double cjson_api_get_number_value(const cJSON* item) {
    return cJSON_GetNumberValue(item);
}

char* cjson_api_get_string_value(const cJSON* item) {
    return cJSON_GetStringValue(item);
}

int cjson_api_get_valueint(const cJSON* item) {
    return item->valueint;
}

int cjson_api_string_equals(const char* actual, const char* expected) {
    return strcmp(actual, expected) == 0;
}

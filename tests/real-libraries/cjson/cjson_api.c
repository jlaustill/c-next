#include "cjson_api.h"

cJSON* cnext_cjson_parse(const char* text) {
    return cJSON_Parse(text);
}

cJSON* cnext_cjson_create_array(void) {
    return cJSON_CreateArray();
}

cJSON* cnext_cjson_create_int_array(const int* numbers, int count) {
    return cJSON_CreateIntArray(numbers, count);
}

cJSON* cnext_cjson_create_object(void) {
    return cJSON_CreateObject();
}

cJSON* cnext_cjson_create_number(double value) {
    return cJSON_CreateNumber(value);
}

cJSON* cnext_cjson_create_string(const char* value) {
    return cJSON_CreateString(value);
}

char* cnext_cjson_print_unformatted(const cJSON* item) {
    return cJSON_PrintUnformatted(item);
}

void cnext_cjson_delete(cJSON* item) {
    cJSON_Delete(item);
}

void cnext_cjson_free_string(char* text) {
    cJSON_free(text);
}

int cnext_cjson_get_array_size(const cJSON* array) {
    return cJSON_GetArraySize(array);
}

cJSON* cnext_cjson_get_array_item(const cJSON* array, int index) {
    return cJSON_GetArrayItem(array, index);
}

cJSON* cnext_cjson_get_object_item(const cJSON* object, const char* key) {
    return cJSON_GetObjectItemCaseSensitive(object, key);
}

int cnext_cjson_add_item_to_array(cJSON* array, cJSON* item) {
    return cJSON_AddItemToArray(array, item);
}

int cnext_cjson_add_item_to_object(cJSON* object, const char* key, cJSON* item) {
    return cJSON_AddItemToObject(object, key, item);
}

int cnext_cjson_is_number(const cJSON* item) {
    return cJSON_IsNumber(item);
}

int cnext_cjson_is_string(const cJSON* item) {
    return cJSON_IsString(item);
}

double cnext_cjson_get_number_value(const cJSON* item) {
    return cJSON_GetNumberValue(item);
}

char* cnext_cjson_get_string_value(const cJSON* item) {
    return cJSON_GetStringValue(item);
}

int cnext_cjson_get_valueint(const cJSON* item) {
    return item->valueint;
}

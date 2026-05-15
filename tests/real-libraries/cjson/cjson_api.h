#ifndef CJSON_API_H
#define CJSON_API_H

#include "../../libs/cJSON/cJSON.h"

cJSON* cnext_cjson_parse(const char* text);
cJSON* cnext_cjson_create_array(void);
cJSON* cnext_cjson_create_int_array(const int* numbers, int count);
cJSON* cnext_cjson_create_object(void);
cJSON* cnext_cjson_create_number(double value);
cJSON* cnext_cjson_create_string(const char* value);
char* cnext_cjson_print_unformatted(const cJSON* item);
void cnext_cjson_delete(cJSON* item);
void cnext_cjson_free_string(char* text);
int cnext_cjson_get_array_size(const cJSON* array);
cJSON* cnext_cjson_get_array_item(const cJSON* array, int index);
cJSON* cnext_cjson_get_object_item(const cJSON* object, const char* key);
int cnext_cjson_add_item_to_array(cJSON* array, cJSON* item);
int cnext_cjson_add_item_to_object(cJSON* object, const char* key, cJSON* item);
int cnext_cjson_is_number(const cJSON* item);
int cnext_cjson_is_string(const cJSON* item);
double cnext_cjson_get_number_value(const cJSON* item);
char* cnext_cjson_get_string_value(const cJSON* item);
int cnext_cjson_get_valueint(const cJSON* item);
int cnext_cjson_string_equals(const char* actual, const char* expected);

#endif /* CJSON_API_H */

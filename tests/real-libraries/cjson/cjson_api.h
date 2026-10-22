#ifndef CJSON_API_H
#define CJSON_API_H

#include <stdint.h>
#include "../../libs/cJSON/cJSON.h"

cJSON* cjson_api_parse(const char* text);
cJSON* cjson_api_create_array(void);
cJSON* cjson_api_create_int_array(const int32_t* numbers, int32_t count);
cJSON* cjson_api_create_object(void);
cJSON* cjson_api_create_number(double value);
cJSON* cjson_api_create_string(const char* value);
char* cjson_api_print_unformatted(const cJSON* item);
void cjson_api_delete(cJSON* item);
void cjson_api_free_string(char* text);
int cjson_api_get_array_size(const cJSON* array);
cJSON* cjson_api_get_array_item(const cJSON* array, int index);
cJSON* cjson_api_get_object_item(const cJSON* object, const char* key);
int cjson_api_add_item_to_array(cJSON* array, cJSON* item);
int cjson_api_add_item_to_object(cJSON* object, const char* key, cJSON* item);
int cjson_api_is_number(const cJSON* item);
int cjson_api_is_string(const cJSON* item);
double cjson_api_get_number_value(const cJSON* item);
char* cjson_api_get_string_value(const cJSON* item);
int cjson_api_get_valueint(const cJSON* item);
int cjson_api_string_equals(const char* actual, const char* expected);

#endif /* CJSON_API_H */

// External C++ header defining typedef'd pointer types (handle pattern)
// Common in ESP-IDF and other embedded frameworks

struct opaque_t {
    int value;
};

// handle_t is a typedef'd pointer type
typedef struct opaque_t* handle_t;

// Create function takes handle_t* (double pointer) as output param
// The handle is allocated and returned via the output parameter
void create_handle(handle_t *out) {
    static struct opaque_t storage = { 42 };
    *out = &storage;
}

// Use function takes handle_t directly (single pointer)
int use_handle(handle_t h) {
    return h->value;
}

// Modify via output param - takes handle_t* to modify the handle itself
void replace_handle(handle_t *out) {
    static struct opaque_t storage2 = { 100 };
    *out = &storage2;
}

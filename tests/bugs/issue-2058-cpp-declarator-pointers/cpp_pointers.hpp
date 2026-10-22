#ifndef CPP_POINTERS_HPP
#define CPP_POINTERS_HPP

/*
 * #2058: C++ declarators whose pointer depth cnx must keep, as it does
 * for the same declarations in a C header. Defined static so the execution
 * fixture needs no companion source file.
 */
struct Sensor {
    int v;
};

static Sensor sensor_value = {42};
static int counter = 3;

Sensor* sensor_get();
inline Sensor* sensor_get() { return &sensor_value; }

inline Sensor* sensor_direct() { return &sensor_value; }

static int *p = &counter;

static void open_it(int **out) { **out = 9; }

#endif

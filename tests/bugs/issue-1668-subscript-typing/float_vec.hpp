#ifndef FLOAT_VEC_HPP
#define FLOAT_VEC_HPP
class FVec {
public:
    float data[4];
    float &operator[](int i) { return data[i]; }
};
extern FVec fv;
#endif

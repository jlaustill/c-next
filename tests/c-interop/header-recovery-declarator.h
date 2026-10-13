/* A raw #ifdef branch reaches the C header parser unpreprocessed */
void good(int a);
#ifdef OTHER_COMPILER
int a, 8[2];
#endif

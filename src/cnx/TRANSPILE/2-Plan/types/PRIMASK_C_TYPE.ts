/**
 * ADR-050: the C type a masked region saves the interrupt mask in -- 2.2
 * plans its header from it and 2.3 writes it (#1991)
 */
const PRIMASK_C_TYPE = "uint32_t";

export default PRIMASK_C_TYPE;

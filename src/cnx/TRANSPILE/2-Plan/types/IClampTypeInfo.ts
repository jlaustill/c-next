/**
 * Type information a clamp helper is generated from (#1991: 2.2 decides it)
 */
interface IClampTypeInfo {
  cType: string;
  widerType: string;
  maxValue: string;
  minValue: string;
  cnxType: string;
  isUnsigned: boolean;
  useWiderArithmetic: boolean;
}

export default IClampTypeInfo;

import ITypeAccessors from "../ITypeAccessors";

/**
 * Typed builder for ITypeAccessors mocks.
 *
 * Every accessor defaults to returning null, so a test states only the
 * alternative it is exercising. Hand-rolled literals cast with `as never`
 * silently omitted accessors a resolver had not called yet: the nested
 * `arrayType()` mocks in FunctionContextManager.test.ts supplied three of the
 * six, which was fine while each resolver probed its own subset and threw
 * "accessors.scopedType is not a function" the moment one ladder probed all six
 * (#1285). Returning a real ITypeAccessors makes that a compile error instead.
 */
class TestTypeAccessors {
  static create(overrides: Partial<ITypeAccessors> = {}): ITypeAccessors {
    return {
      primitiveType: () => null,
      userType: () => null,
      stringType: () => null,
      scopedType: () => null,
      qualifiedType: () => null,
      globalType: () => null,
      arrayType: () => null,
      ...overrides,
    };
  }
}

export default TestTypeAccessors;

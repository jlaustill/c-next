/**
 * Everything 1.4 Resolve needs besides the files themselves.
 *
 * ## Why one object rather than a positional list (#1452)
 *
 * `Program.build` reached eight positional parameters, seven of them with
 * defaults, and TypeScript refused the eighth before anything else did. The
 * defaults are what hid the growth: each new parameter compiled silently, so
 * the signature widened without a single call site objecting. A seven-parameter
 * builder with seven defaults is exactly as coupled as an eight-parameter one
 * -- it just does not say so.
 *
 * The count was not the real cost either. Positionally, adding an input meant
 * editing the signature, every full call, and every test that passed a later
 * argument by position; a named field means editing the interface and the
 * producer. #1452 still has `SymbolTable` and `CodeGenState` to move, and
 * both will want to arrive the same way, so the change point is worth having once.
 *
 * Every field is optional and carries the same empty default the positional
 * form did, so a caller that supplied nothing still supplies nothing.
 */
import type IDiscoveryFacts from "./IDiscoveryFacts";
import type IForeignSymbols from "./IForeignSymbols";
import type IModificationFacts from "./IModificationFacts";
import type IStructFieldInfo from "./symbols/IStructFieldInfo";
import type IVisibilityInput from "./IVisibilityInput";
import type SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";

interface IProgramInputs {
  /** Struct fields the C and C++ headers contributed, by type name. */
  readonly headerStructFields?: ReadonlyMap<
    string,
    ReadonlyMap<string, IStructFieldInfo>
  >;

  /** The C and C++ halves of the conflict question, plus the opacity inputs. */
  readonly foreign?: IForeignSymbols;

  /**
   * ADR-006's modification facts.
   *
   * Derived BEFORE this artifact exists -- `ModificationFacts.derive` runs
   * ahead of `Program.build` and takes the scope graph directly for that
   * reason. A fact needed to build the program cannot be reached through it.
   */
  readonly modifications?: IModificationFacts;

  /** ADR-016 visibility inputs. */
  readonly visibility?: IVisibilityInput;

  /** Functions used as an ADR-029 callback, to the typedef they are used as. */
  readonly callbackCompatibleFunctions?: ReadonlyMap<string, string>;

  /** What 1.1 Discover learned about each file's includes. */
  readonly discovery?: IDiscoveryFacts;

  /**
   * The run's scope graph (#1452 box 3).
   *
   * Absent only where a test builds a program without one; production always
   * supplies the registry the run constructed.
   */
  readonly registry?: SymbolRegistry;
}

export default IProgramInputs;

import { extname } from "node:path";
import EFileType from "../PARSE/1-Discover/types/EFileType";
import CNextSourcePath from "./CNextSourcePath";

const EXTENSION_MAP: Record<string, EFileType> = {
  ".h": EFileType.CHeader,
  ".hpp": EFileType.CppHeader,
  ".hxx": EFileType.CppHeader,
  ".hh": EFileType.CppHeader,
  ".c": EFileType.CSource,
  ".cpp": EFileType.CppSource,
  ".cxx": EFileType.CppSource,
  ".cc": EFileType.CppSource,
  // #1840, owner ruling 4 on #1444: GCC treats `.c++` as C++ source, and the
  // CLI already accepted it as a C++ entry point. E0503 reads this row too
  ".c++": EFileType.CppSource,
};

/**
 * A file's kind from its path alone. 1.1 classifies every file it finds by
 * it, and 1.2 the files a header's compile opened that 1.1 never found (#1713).
 */
class FileKinds {
  static of(filePath: string): EFileType {
    if (CNextSourcePath.isSource(filePath)) return EFileType.CNext;
    if (CNextSourcePath.isRejected(filePath)) return EFileType.RejectedCNext;
    return EXTENSION_MAP[extname(filePath).toLowerCase()] ?? EFileType.Unknown;
  }
}

export default FileKinds;

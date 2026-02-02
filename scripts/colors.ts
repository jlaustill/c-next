/**
 * Shared color utilities using chalk
 * Provides consistent terminal coloring across all scripts
 */
import chalk from "chalk";

class Colors {
  static reset(text: string): string {
    return text;
  }

  static green(text: string): string {
    return chalk.green(text);
  }

  static red(text: string): string {
    return chalk.red(text);
  }

  static yellow(text: string): string {
    return chalk.yellow(text);
  }

  static cyan(text: string): string {
    return chalk.cyan(text);
  }

  static dim(text: string): string {
    return chalk.dim(text);
  }

  static bright(text: string): string {
    return chalk.bold(text);
  }

  static blue(text: string): string {
    return chalk.blue(text);
  }
}

export default Colors;

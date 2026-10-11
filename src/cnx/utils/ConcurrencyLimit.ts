/**
 * Runs async tasks with at most `max` in flight at once (#1817).
 *
 * Header preprocessing starts one C preprocessor process per header, and a
 * large embedded project includes hundreds. Unbounded, they would all start
 * together.
 *
 * A finishing task hands its slot straight to the next waiter rather than
 * releasing it. Releasing first would let a caller arriving in between take the
 * slot too, and the count would briefly exceed `max`.
 */
class ConcurrencyLimit {
  static create(max: number): <T>(task: () => Promise<T>) => Promise<T> {
    let active = 0;
    const waiting: Array<() => void> = [];

    return async <T>(task: () => Promise<T>): Promise<T> => {
      if (active < max) {
        active += 1;
      } else {
        await new Promise<void>((resolve) => {
          waiting.push(resolve);
        });
      }
      try {
        return await task();
      } finally {
        const next = waiting.shift();
        if (next) {
          next();
        } else {
          active -= 1;
        }
      }
    };
  }
}

export default ConcurrencyLimit;

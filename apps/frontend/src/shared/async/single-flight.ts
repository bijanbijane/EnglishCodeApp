export type SingleFlightGuard = {
  run<T>(operation: () => Promise<T>): Promise<T | undefined>;
};

/**
 * Prevents overlapping executions of a UI action within one mounted owner.
 * Server-side idempotency is still required for retries and cross-client safety.
 */
export function createSingleFlightGuard(): SingleFlightGuard {
  let inFlight = false;

  return {
    run<T>(operation: () => Promise<T>): Promise<T | undefined> {
      if (inFlight) return Promise.resolve(undefined);
      inFlight = true;
      return Promise.resolve()
        .then(operation)
        .finally(() => {
          inFlight = false;
        });
    },
  };
}

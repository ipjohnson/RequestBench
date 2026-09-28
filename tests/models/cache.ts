/**
 * The keys a cache route takes as its last segment. Each instance of a cache test draws one, so a
 * test covers every key, times the header values it varies on, and a framework's store has to hold
 * all of them at once.
 */
export const CACHE_KEYS = ["k1", "k2", "k3", "k4"] as const;

/**
 * How long a stored answer lives. A rung records for 60 seconds, so each key expires about twice
 * in it, and a store that expires on time runs the handler once per key each time.
 */
export const CACHE_LIFETIME_SECONDS = 30;

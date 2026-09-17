package rb.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The response cache a target holds when its framework ships none.
 *
 * Three of the six do ship one and use it: Spring's cache abstraction, Quarkus's
 * {@code @CacheResult} and Micronaut's {@code @Cacheable} all store what a method returned,
 * which for a handler returning a response object is the whole response. The other three
 * have nothing to reach for, so this is what they share, for the same reason the digest in
 * {@link Domain#contentETag} is shared: three copies would drift and the drift would read
 * as a framework result. Where they differ is which hook each attaches it to.
 *
 * An LRU with a per-entry expiry, sized from the fixture. Capped rather than unbounded
 * because the point of the capacity is that nothing evicts inside a run, and a cap the key
 * count fits under says that out loud where an unbounded map would only happen to be true.
 */
public final class ResponseStore {

  /** One response held in the store: everything needed to write it again. */
  public record Stored(int status, Map<String, List<String>> headers, byte[] body) {}

  // Not named Entry: a nested type by that name collides with Map.Entry in the anonymous
  // LinkedHashMap below, and the two have the same erasure.
  private record Held(Stored value, long expiresAtNanos) {}

  private final long ttlNanos;
  private final Map<String, Held> entries;

  public ResponseStore() {
    Model.CacheDoc spec = Domain.cache();
    this.ttlNanos = spec.ttlSeconds() * 1_000_000_000L;
    int capacity = spec.capacity();
    this.entries = java.util.Collections.synchronizedMap(
        new LinkedHashMap<>(capacity * 2, 0.75f, true) {
          @Override
          protected boolean removeEldestEntry(Map.Entry<String, Held> eldest) {
            return size() > capacity;
          }
        });
  }

  public Stored get(String key) {
    Held e = entries.get(key);
    if (e == null) {
      return null;
    }
    if (System.nanoTime() > e.expiresAtNanos()) {
      entries.remove(key);
      return null;
    }
    return e.value();
  }

  public void put(String key, Stored value) {
    entries.put(key, new Held(value, System.nanoTime() + ttlNanos));
  }

  /** The path plus the value of each header this route is keyed on. */
  public static String key(String path, List<String> values) {
    StringBuilder out = new StringBuilder(path);
    for (String v : values) {
      out.append('|').append(v == null ? "" : v);
    }
    return out.toString();
  }
}

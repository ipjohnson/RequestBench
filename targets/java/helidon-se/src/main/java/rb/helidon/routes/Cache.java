package rb.helidon.routes;

import io.helidon.http.HeaderNames;
import io.helidon.webserver.http.Handler;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Json;
import rb.domain.ResponseStore;

/**
 * cache: a handler that answers from the store before the payload is built.
 *
 * Helidon SE ships no response cache, so the store is the shared LRU sized from the fixture
 * and the handler is where it is consulted, which is this framework's unit of composition.
 */
public final class Cache {
  private Cache() {}

  private static final ResponseStore STORE = new ResponseStore();

  private static String keyOf(ServerRequest req, String path, List<String> on) {
    List<String> values = new ArrayList<>(on.size());
    for (String name : on) {
      values.add(req.headers().value(HeaderNames.create(name)).orElse(""));
    }
    return ResponseStore.key(path, values);
  }

  private static Handler cached(String path, String size, List<String> on) {
    return (req, res) -> {
      String key = keyOf(req, path, on);
      ResponseStore.Stored hit = STORE.get(key);
      if (hit == null) {
        byte[] raw = Json.bytes(Domain.payload(size));
        Map<String, List<String>> headers = new LinkedHashMap<>();
        headers.put("x-rb-serial", List.of(Domain.nextSerial()));
        if (!on.isEmpty()) {
          headers.put("vary", List.of(String.join(", ", on)));
        }
        hit = new ResponseStore.Stored(200, headers, raw);
        STORE.put(key, hit);
      }
      hit.headers().forEach((name, values) -> values.forEach(v -> res.header(name, v)));
      res.header(HeaderNames.CONTENT_TYPE.defaultCase(), "application/json");
      res.status(hit.status()).send(hit.body());
    };
  }

  public static void register(HttpRouting.Builder r) {
    // rb:snippet cache.small cache.medium cache.large
    for (String size : new String[] {"small", "medium", "large"}) {
      r.get("/cache/" + size, cached("/cache/" + size, size, List.of()));
    }
    // rb:snippet cache.vary_one cache.vary_many
    for (String which : new String[] {"one", "many"}) {
      String path = "/cache/vary/" + which;
      r.get(path, cached(path, "small", Domain.varyOn(which)));
    }
  }
}

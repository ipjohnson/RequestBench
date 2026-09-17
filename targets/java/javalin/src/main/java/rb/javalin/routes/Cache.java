package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Json;
import rb.domain.ResponseStore;

/**
 * cache: a Javalin before-handler that answers from the store, and an after-handler that
 * fills it.
 *
 * Javalin ships no response cache, so the store is the shared LRU sized from the fixture.
 * What is Javalin's own is the pair of hooks and their patterns: before() can end a request
 * with skipRemainingHandlers, which is what makes a hit skip the handler rather than merely
 * shorten it.
 */
public final class Cache {
  private Cache() {}

  // rb:wiring cache.*
  private static final ResponseStore STORE = new ResponseStore();
  /** Path to the header names that path is keyed on, which is the vary. */
  private static final Map<String, List<String>> VARY = new LinkedHashMap<>();

  // rb:wiring cache.*
  private static String keyOf(io.javalin.http.Context ctx) {
    List<String> values = new ArrayList<>();
    for (String name : VARY.getOrDefault(ctx.path(), List.of())) {
      String v = ctx.header(name);
      values.add(v == null ? "" : v);
    }
    return ResponseStore.key(ctx.path(), values);
  }

  public static void register(JavalinConfig cfg) {
    for (String which : new String[] {"one", "many"}) {
      VARY.put("/cache/vary/" + which, Domain.varyOn(which));
    }
    cfg.routes.before("/cache/*", ctx -> {
      ResponseStore.Stored hit = STORE.get(keyOf(ctx));
      if (hit == null) {
        return;
      }
      hit.headers().forEach((name, values) -> values.forEach(v -> ctx.header(name, v)));
      ctx.contentType("application/json");
      ctx.status(hit.status());
      ctx.result(hit.body());
      ctx.skipRemainingHandlers();
    });
    cfg.routes.after("/cache/*", ctx -> {
      String key = keyOf(ctx);
      if (ctx.status().getCode() != 200 || STORE.get(key) != null) {
        return;
      }
      String result = ctx.result();
      byte[] raw = result == null ? new byte[0] : result.getBytes(StandardCharsets.UTF_8);
      Map<String, List<String>> headers = new LinkedHashMap<>();
      for (String name : new String[] {"x-rb-serial", "vary"}) {
        String v = ctx.res().getHeader(name);
        if (v != null) {
          headers.put(name, List.of(v));
        }
      }
      STORE.put(key, new ResponseStore.Stored(200, headers, raw));
      ctx.result(raw);
    });
    // rb:handler cache.small,cache.medium,cache.large
    for (String size : new String[] {"small", "medium", "large"}) {
      cfg.routes.get("/cache/" + size, ctx -> {
        ctx.header("x-rb-serial", Domain.nextSerial());
        ctx.json(Domain.payload(size));
      });
    }
    // rb:handler cache.vary_one,cache.vary_many
    for (String which : new String[] {"one", "many"}) {
      List<String> on = Domain.varyOn(which);
      cfg.routes.get("/cache/vary/" + which, ctx -> {
        ctx.header("vary", String.join(", ", on));
        ctx.header("x-rb-serial", Domain.nextSerial());
        ctx.json(Domain.payload("small"));
      });
    }
  }
}

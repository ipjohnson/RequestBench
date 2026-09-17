package rb.vertx.routes;

import io.vertx.core.buffer.Buffer;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
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
 * Vert.x ships no response cache, so the store is the shared LRU sized from the fixture.
 * The handler is registered on the route rather than inside the payload handler, which is
 * Vert.x Web's own composition: a hit ends the response and never calls next(), so the
 * handler below it does not run.
 */
public final class Cache {
  private Cache() {}

  private static final ResponseStore STORE = new ResponseStore();

  private static String keyOf(RoutingContext ctx, List<String> on) {
    List<String> values = new ArrayList<>(on.size());
    for (String name : on) {
      String v = ctx.request().getHeader(name);
      values.add(v == null ? "" : v);
    }
    return ResponseStore.key(ctx.request().path(), values);
  }

  private static void replayed(RoutingContext ctx, ResponseStore.Stored hit) {
    hit.headers().forEach((name, values) -> values.forEach(v -> ctx.response().putHeader(name, v)));
    ctx.response()
       .setStatusCode(hit.status())
       .putHeader("content-type", "application/json")
       .putHeader("content-length", Integer.toString(hit.body().length))
       .end(Buffer.buffer(hit.body()));
  }

  private static void register(Router router, String path, String size, List<String> on) {
    router.route(path).handler(ctx -> {
      String key = keyOf(ctx, on);
      ResponseStore.Stored hit = STORE.get(key);
      if (hit != null) {
        replayed(ctx, hit);
        return;
      }
      byte[] raw = Json.bytes(Domain.payload(size));
      Map<String, List<String>> headers = new LinkedHashMap<>();
      headers.put("x-rb-serial", List.of(Domain.nextSerial()));
      if (!on.isEmpty()) {
        headers.put("vary", List.of(String.join(", ", on)));
      }
      ResponseStore.Stored fresh = new ResponseStore.Stored(200, headers, raw);
      STORE.put(key, fresh);
      replayed(ctx, fresh);
    });
  }

  public static void register(Router router) {
    // rb:snippet cache.small cache.medium cache.large
    for (String size : new String[] {"small", "medium", "large"}) {
      register(router, "/cache/" + size, size, List.of());
    }
    // rb:snippet cache.vary_one cache.vary_many
    for (String which : new String[] {"one", "many"}) {
      register(router, "/cache/vary/" + which, "small", Domain.varyOn(which));
    }
  }
}

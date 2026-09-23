package implementation.routes;

import java.util.List;

import implementation.Payloads;
import implementation.Serial;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.core.json.JsonObject;
import io.vertx.core.shareddata.LocalMap;
import io.vertx.core.shareddata.Shareable;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;

/**
 * cache: a stored answer replayed with the route's handler skipped. Vert.x Web ships no response
 * cache, so the store and the handler in front of each route are written for it. A handler cannot
 * read what another handler wrote, so the route's handler hands its answer to the store, which
 * keeps it and writes it. The store is a local map of Vert.x's shared data, which every server
 * verticle in the process uses. The route's handler writes x-rb-serial, so a replayed answer
 * repeats the serial it was stored with.
 */
public final class CacheRoutes {

    private CacheRoutes() {}

    public static void register(Router router, Vertx vertx, Payloads p) {
        JsonObject settings = p.settings().getJsonObject("cache");
        List<String> one = List.copyOf(settings.getJsonObject("vary").getJsonObject("one").fieldNames());
        List<String> many = List.copyOf(settings.getJsonObject("vary").getJsonObject("many").fieldNames());
        // rb:wiring cache.*
        Store store = new Store(vertx.sharedData().getLocalMap("cache"), settings.getInteger("capacity"),
                settings.getInteger("ttlSeconds") * 1000L);
        // rb:end

        router.get("/cache/small").handler(store.replay(List.of())).handler(ctx -> store.keep(ctx, p.small(), List.of()));

        router.get("/cache/medium").handler(store.replay(List.of())).handler(ctx -> store.keep(ctx, p.medium(), List.of()));

        router.get("/cache/large").handler(store.replay(List.of())).handler(ctx -> store.keep(ctx, p.large(), List.of()));

        router.get("/cache/vary/one").handler(store.replay(one)).handler(ctx -> store.keep(ctx, p.small(), one));

        router.get("/cache/vary/many").handler(store.replay(many)).handler(ctx -> store.keep(ctx, p.small(), many));
    }

    // rb:wiring cache.*
    /** An answer as it was written, and when it stops being replayed. */
    private record Stored(String serial, String vary, Buffer body, long expires) implements Shareable {

        void writeTo(HttpServerResponse response) {
            response.putHeader(Serial.HEADER, serial).putHeader(HttpHeaders.CONTENT_TYPE, "application/json");
            if (vary != null) {
                response.putHeader(HttpHeaders.VARY, vary);
            }
            response.end(body);
        }
    }

    /**
     * Sized in entries and aged by settings.json. A full store drops one entry to take another,
     * whichever the map's key set yields first.
     */
    private record Store(LocalMap<String, Stored> entries, int capacity, long ttlMillis) {

        private static final String KEY = "cache.key";

        /**
         * Answers from the store before the route's handler runs, and otherwise passes the request
         * on with its key. The key is the path, and the value of each header the route varies on.
         */
        Handler<RoutingContext> replay(List<String> vary) {
            return ctx -> {
                StringBuilder key = new StringBuilder(ctx.request().path());
                for (String name : vary) {
                    key.append('\n').append(ctx.request().getHeader(name));
                }
                Stored hit = entries.get(key.toString());
                if (hit != null && hit.expires() > System.currentTimeMillis()) {
                    hit.writeTo(ctx.response());
                    return;
                }
                ctx.put(KEY, key.toString());
                ctx.next();
            };
        }

        /**
         * What the route's handler answers, kept under the request's key and written. The Vary
         * header tells a cache in front of the framework what the answer depends on.
         */
        void keep(RoutingContext ctx, JsonObject payload, List<String> vary) {
            Stored answer = new Stored(Serial.next(), vary.isEmpty() ? null : String.join(", ", vary), payload.toBuffer(),
                    System.currentTimeMillis() + ttlMillis);
            String key = ctx.get(KEY);
            if (!entries.containsKey(key) && entries.size() >= capacity) {
                entries.keySet().stream().findFirst().ifPresent(entries::remove);
            }
            entries.put(key, answer);
            answer.writeTo(ctx.response());
        }
    }
    // rb:end
}

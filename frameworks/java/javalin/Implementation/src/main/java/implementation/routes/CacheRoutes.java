package implementation.routes;

import java.io.IOException;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.http.Header;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiParam;
import io.javalin.openapi.OpenApiResponse;

/**
 * cache: a stored answer replayed in place of the route. Javalin ships no response cache, so the
 * store and the two handlers around these routes are written for it. The route writes x-rb-serial,
 * so a replayed answer repeats the serial it was stored with.
 */
public final class CacheRoutes {

    private record Stored(String contentType, String serial, String vary, byte[] body, long expires) {}

    private final Payloads p;

    /** The request headers each vary route is keyed on, by path. */
    private final Map<String, List<String>> keyedOn;

    private final String varyOne;

    private final String varyMany;

    private final Map<String, Stored> store = new ConcurrentHashMap<>();

    private final int capacity;

    private final long ttlNanos;

    public CacheRoutes(Payloads p) {
        this.p = p;
        Settings.Cache cache = p.settings().cache();
        List<String> one = List.copyOf(cache.vary().one().keySet());
        List<String> many = List.copyOf(cache.vary().many().keySet());
        this.keyedOn = Map.of("/cache/vary/one", one, "/cache/vary/many", many);
        this.varyOne = String.join(", ", one);
        this.varyMany = String.join(", ", many);
        this.capacity = cache.capacity();
        this.ttlNanos = TimeUnit.SECONDS.toNanos(cache.ttlSeconds());
    }

    public void register(JavalinConfig config) {
        // rb:wiring cache.*
        config.routes.before("/cache/*", this::replay);
        config.routes.after("/cache/*", this::keep);
        // rb:end
        config.routes.get("/cache/small", this::small);
        config.routes.get("/cache/medium", this::medium);
        config.routes.get("/cache/large", this::large);
        config.routes.get("/cache/vary/one", this::varyOne);
        config.routes.get("/cache/vary/many", this::varyMany);
    }

    // rb:wiring cache.*
    /** Answers from the store when it holds this request's key, and skips the route and every handler after it. */
    private void replay(Context ctx) {
        Stored hit = store.get(key(ctx));
        if (hit == null || hit.expires() - System.nanoTime() < 0) {
            return;
        }
        ctx.header(Serial.HEADER, hit.serial());
        if (hit.vary() != null) {
            ctx.header(Header.VARY, hit.vary());
        }
        ctx.contentType(hit.contentType()).result(hit.body()).skipRemainingHandlers();
    }

    /**
     * Stores what the route answered, for settings.json's TTL. A full store drops one entry to take
     * another, whichever the map yields first.
     */
    private void keep(Context ctx) throws IOException {
        if (ctx.statusCode() != 200 || ctx.resultInputStream() == null) {
            return;
        }
        byte[] body = ctx.resultInputStream().readAllBytes();
        ctx.result(body);
        String key = key(ctx);
        if (!store.containsKey(key) && store.size() >= capacity) {
            Iterator<String> any = store.keySet().iterator();
            if (any.hasNext()) {
                store.remove(any.next());
            }
        }
        store.put(key, new Stored(ctx.res().getContentType(), ctx.res().getHeader(Serial.HEADER),
                ctx.res().getHeader(Header.VARY), body, System.nanoTime() + ttlNanos));
    }

    /** The path, and the value of each header the route is keyed on. */
    private String key(Context ctx) {
        List<String> names = keyedOn.get(ctx.path());
        if (names == null) {
            return ctx.path();
        }
        StringBuilder key = new StringBuilder(ctx.path());
        for (String name : names) {
            key.append('\n').append(ctx.header(name));
        }
        return key.toString();
    }
    // rb:end

    // rb:handler cache.small
    @OpenApi(path = "/cache/small",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void small(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.small());
    }

    // rb:handler cache.medium
    @OpenApi(path = "/cache/medium",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void medium(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.medium());
    }

    // rb:handler cache.large
    @OpenApi(path = "/cache/large",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void large(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.large());
    }

    // The Vary header tells a cache in front of the framework what the answer depends on. The store
    // keys on the route's own list of headers, not on this header.
    // rb:handler cache.vary_one
    @OpenApi(path = "/cache/vary/one",
            headers = @OpenApiParam(name = "x-rb-tenant"),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void varyOne(Context ctx) {
        ctx.header(Header.VARY, varyOne);
        Serial.write(ctx);
        ctx.json(p.small());
    }

    // rb:handler cache.vary_many
    @OpenApi(path = "/cache/vary/many",
            headers = {@OpenApiParam(name = "x-rb-channel"), @OpenApiParam(name = "x-rb-region"), @OpenApiParam(name = "x-rb-tenant")},
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void varyMany(Context ctx) {
        ctx.header(Header.VARY, varyMany);
        Serial.write(ctx);
        ctx.json(p.small());
    }
}

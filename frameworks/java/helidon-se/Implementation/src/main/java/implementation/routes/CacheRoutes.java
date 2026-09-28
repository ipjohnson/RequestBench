package implementation.routes;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.helidon.common.media.type.MediaTypes;
import io.helidon.http.HeaderName;
import io.helidon.http.HeaderNames;
import io.helidon.json.binding.JsonBinding;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;
import io.helidon.webserver.http.ServerResponse;

/**
 * cache: Helidon SE has no response cache, so the store and the replay are written for this
 * family. The first request for a key builds the answer and stores its body with the x-rb-serial
 * it was written with, and every later one is answered from the store without building anything
 * until 30 seconds have passed.
 */
public final class CacheRoutes implements HttpFeature {

    private final Payloads p;

    private final Vary one;

    private final Vary many;

    private final JsonBinding json = JsonBinding.create();

    // rb:wiring cache.*
    /** One store for the process, keyed by the path and the values of the headers the route varies on. */
    private final Map<String, Stored> store = new ConcurrentHashMap<>();

    private final long ttlNanos = TimeUnit.SECONDS.toNanos(30);

    record Stored(String serial, byte[] body, long expires) {}

    /** The headers a route varies on, and the Vary header that names them. */
    record Vary(List<HeaderName> names, String header) {

        static final Vary NONE = new Vary(List.of(), null);

        static Vary on(String... names) {
            return new Vary(Stream.of(names).map(HeaderNames::create).toList(), String.join(", ", names));
        }
    }
    // rb:end

    public CacheRoutes(Payloads p) {
        this.p = p;
        this.one = Vary.on("x-rb-tenant");
        this.many = Vary.on("x-rb-channel", "x-rb-region", "x-rb-tenant");
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/cache/small/{key}", (req, res) -> replay(req, res, Vary.NONE, p::small));

        routing.get("/cache/medium/{key}", (req, res) -> replay(req, res, Vary.NONE, p::medium));

        routing.get("/cache/large/{key}", (req, res) -> replay(req, res, Vary.NONE, p::large));

        routing.get("/cache/vary/one/{key}", (req, res) -> replay(req, res, one, p::small));

        routing.get("/cache/vary/many/{key}", (req, res) -> replay(req, res, many, p::small));
    }

    // rb:wiring cache.*
    /**
     * The stored answer for this request's key, built and stored first when there is none or it has
     * expired. The Vary header tells a cache in front of the framework what the answer depends on.
     */
    private void replay(ServerRequest req, ServerResponse res, Vary vary, Supplier<Payload> payload) {
        StringBuilder key = new StringBuilder(req.path().path());
        for (HeaderName name : vary.names()) {
            key.append('\n').append(req.headers().value(name).orElse(""));
        }
        String k = key.toString();
        long now = System.nanoTime();
        Stored answer = store.get(k);
        if (answer == null || answer.expires() - now <= 0) {
            answer = store.compute(k, (same, old) -> old != null && old.expires() - now > 0 ? old
                    : new Stored(Serial.next(), json.serializeToBytes(payload.get(), Payload.class), now + ttlNanos));
        }
        res.header(Serial.HEADER, answer.serial());
        if (vary.header() != null) {
            res.header(HeaderNames.VARY, vary.header());
        }
        res.headers().contentType(MediaTypes.APPLICATION_JSON);
        res.send(answer.body());
    }
}

package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.micronaut.cache.annotation.Cacheable;
import io.micronaut.core.annotation.Nullable;
import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import jakarta.inject.Singleton;

/**
 * cache: micronaut-cache over Caffeine. @Cacheable stores what a method returned and returns it
 * again without running the method, keyed by the method's arguments. What is stored is the payload
 * and the serial it was written with, and each handler builds its answer from that, because
 * Micronaut writes to a response while it answers with it. Each route passes the key in its path
 * and, on the vary routes, the headers as arguments for the key.
 */
@Controller
public class CacheRoutes {

    /** An answer as the cache stores it. */
    public record Stored(Payload payload, String serial) {}

    private final Answers answers;

    CacheRoutes(Answers answers) {
        this.answers = answers;
    }

    @Get("/cache/small/{key}")
    public HttpResponse<Payload> small(String key) {
        return replay(answers.small(key), null);
    }

    @Get("/cache/medium/{key}")
    public HttpResponse<Payload> medium(String key) {
        return replay(answers.medium(key), null);
    }

    @Get("/cache/large/{key}")
    public HttpResponse<Payload> large(String key) {
        return replay(answers.large(key), null);
    }

    @Get("/cache/vary/one/{key}")
    public HttpResponse<Payload> varyOne(String key, @Header("x-rb-tenant") @Nullable String tenant) {
        return replay(answers.varyOne(key, tenant), "x-rb-tenant");
    }

    @Get("/cache/vary/many/{key}")
    public HttpResponse<Payload> varyMany(String key,
                                          @Header("x-rb-channel") @Nullable String channel,
                                          @Header("x-rb-region") @Nullable String region,
                                          @Header("x-rb-tenant") @Nullable String tenant) {
        return replay(answers.varyMany(key, channel, region, tenant), "x-rb-channel, x-rb-region, x-rb-tenant");
    }

    /**
     * The Vary header tells a cache in front of the framework what the answer depends on.
     * micronaut-cache keys on the arguments, not on this header.
     */
    private static HttpResponse<Payload> replay(Stored stored, String vary) {
        MutableHttpResponse<Payload> answer = HttpResponse.ok(stored.payload()).header(Serial.HEADER, stored.serial());
        if (vary != null) {
            answer.header(HttpHeaders.VARY, vary);
        }
        return answer;
    }

    // rb:wiring cache.*
    /**
     * The methods whose results the caches store. @Cacheable runs through the bean's proxy, so they
     * are a bean of their own.
     */
    @Singleton
    public static class Answers {

        private final Payloads p;

        Answers(Payloads p) {
            this.p = p;
        }

        @Cacheable("cache-small")
        public Stored small(String key) {
            return new Stored(p.small(), Serial.next());
        }

        @Cacheable("cache-medium")
        public Stored medium(String key) {
            return new Stored(p.medium(), Serial.next());
        }

        @Cacheable("cache-large")
        public Stored large(String key) {
            return new Stored(p.large(), Serial.next());
        }

        @Cacheable("cache-vary-one")
        public Stored varyOne(String key, @Nullable String tenant) {
            return new Stored(p.small(), Serial.next());
        }

        @Cacheable("cache-vary-many")
        public Stored varyMany(String key, @Nullable String channel, @Nullable String region, @Nullable String tenant) {
            return new Stored(p.small(), Serial.next());
        }
    }

    // rb:end
}

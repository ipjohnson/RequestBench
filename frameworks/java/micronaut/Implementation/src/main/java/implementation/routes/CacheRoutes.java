package implementation.routes;

import java.time.Duration;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import io.micronaut.cache.CacheConfiguration;
import io.micronaut.cache.annotation.Cacheable;
import io.micronaut.cache.caffeine.DefaultCacheConfiguration;
import io.micronaut.context.annotation.Factory;
import io.micronaut.core.annotation.Nullable;
import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import io.micronaut.runtime.ApplicationConfiguration;
import jakarta.inject.Named;
import jakarta.inject.Singleton;

/**
 * cache: micronaut-cache over Caffeine. @Cacheable stores what a method returned and returns it
 * again without running the method, keyed by the method's arguments. What is stored is the payload
 * and the serial it was written with, and each handler builds its answer from that, because
 * Micronaut writes to a response while it answers with it. The vary routes pass their headers as
 * arguments for the key.
 */
@Controller
public class CacheRoutes {

    /** An answer as the cache stores it. */
    public record Stored(Payload payload, String serial) {}

    private final Answers answers;

    private final String varyOne;

    private final String varyMany;

    CacheRoutes(Answers answers, Payloads p) {
        this.answers = answers;
        this.varyOne = String.join(", ", p.settings().cache().vary().one().keySet());
        this.varyMany = String.join(", ", p.settings().cache().vary().many().keySet());
    }

    @Get("/cache/small")
    public HttpResponse<Payload> small() {
        return replay(answers.small(), null);
    }

    @Get("/cache/medium")
    public HttpResponse<Payload> medium() {
        return replay(answers.medium(), null);
    }

    @Get("/cache/large")
    public HttpResponse<Payload> large() {
        return replay(answers.large(), null);
    }

    @Get("/cache/vary/one")
    public HttpResponse<Payload> varyOne(@Header("x-rb-tenant") @Nullable String tenant) {
        return replay(answers.varyOne(tenant), varyOne);
    }

    @Get("/cache/vary/many")
    public HttpResponse<Payload> varyMany(@Header("x-rb-channel") @Nullable String channel,
                                          @Header("x-rb-region") @Nullable String region,
                                          @Header("x-rb-tenant") @Nullable String tenant) {
        return replay(answers.varyMany(channel, region, tenant), varyMany);
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
        public Stored small() {
            return new Stored(p.small(), Serial.next());
        }

        @Cacheable("cache-medium")
        public Stored medium() {
            return new Stored(p.medium(), Serial.next());
        }

        @Cacheable("cache-large")
        public Stored large() {
            return new Stored(p.large(), Serial.next());
        }

        @Cacheable("cache-vary-one")
        public Stored varyOne(@Nullable String tenant) {
            return new Stored(p.small(), Serial.next());
        }

        @Cacheable("cache-vary-many")
        public Stored varyMany(@Nullable String channel, @Nullable String region, @Nullable String tenant) {
            return new Stored(p.small(), Serial.next());
        }
    }

    /**
     * One Caffeine cache per route, sized and aged by settings.json. Without these, micronaut-cache
     * creates each cache the first time a method names it, with no size limit and no expiry.
     */
    @Factory
    static final class Caches {

        private final ApplicationConfiguration application;

        private final Settings.Cache settings;

        Caches(ApplicationConfiguration application, Payloads p) {
            this.application = application;
            this.settings = p.settings().cache();
        }

        @Singleton
        @Named("cache-small")
        CacheConfiguration small() {
            return sized("cache-small");
        }

        @Singleton
        @Named("cache-medium")
        CacheConfiguration medium() {
            return sized("cache-medium");
        }

        @Singleton
        @Named("cache-large")
        CacheConfiguration large() {
            return sized("cache-large");
        }

        @Singleton
        @Named("cache-vary-one")
        CacheConfiguration varyOne() {
            return sized("cache-vary-one");
        }

        @Singleton
        @Named("cache-vary-many")
        CacheConfiguration varyMany() {
            return sized("cache-vary-many");
        }

        private CacheConfiguration sized(String name) {
            DefaultCacheConfiguration cache = new DefaultCacheConfiguration(name, application);
            cache.setMaximumSize((long) settings.capacity());
            cache.setExpireAfterWrite(Duration.ofSeconds(settings.ttlSeconds()));
            return cache;
        }
    }
    // rb:end
}

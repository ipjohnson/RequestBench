package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.quarkus.cache.CacheResult;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.HttpHeaders;
import org.jboss.resteasy.reactive.RestHeader;
import org.jboss.resteasy.reactive.RestResponse;

/**
 * cache: Quarkus's cache, which stores what a @CacheResult method returned and returns it again
 * without running the method. A route's cache is keyed by the method's arguments, and the vary
 * routes take their headers as arguments for that reason.
 */
@Path("/cache")
public class CacheRoutes {

    private final Payloads p;

    private final String varyOne;

    private final String varyMany;

    CacheRoutes(Payloads p) {
        this.p = p;
        this.varyOne = String.join(", ", p.settings().cache().vary().one().keySet());
        this.varyMany = String.join(", ", p.settings().cache().vary().many().keySet());
    }

    // rb:handler cache.small
    @GET
    @Path("small")
    @CacheResult(cacheName = "cache.small")
    public Uni<RestResponse<Payload>> small() {
        return stored(p.small(), null);
    }

    // rb:handler cache.medium
    @GET
    @Path("medium")
    @CacheResult(cacheName = "cache.medium")
    public Uni<RestResponse<Payload>> medium() {
        return stored(p.medium(), null);
    }

    // rb:handler cache.large
    @GET
    @Path("large")
    @CacheResult(cacheName = "cache.large")
    public Uni<RestResponse<Payload>> large() {
        return stored(p.large(), null);
    }

    // A lone argument is the key itself, and the cache takes no null key, so a request with no
    // x-rb-tenant is keyed as empty.
    // rb:handler cache.vary_one
    @GET
    @Path("vary/one")
    @CacheResult(cacheName = "cache.vary_one")
    public Uni<RestResponse<Payload>> varyOne(@RestHeader("x-rb-tenant") @DefaultValue("") String tenant) {
        return stored(p.small(), varyOne);
    }

    // rb:handler cache.vary_many
    @GET
    @Path("vary/many")
    @CacheResult(cacheName = "cache.vary_many")
    public Uni<RestResponse<Payload>> varyMany(@RestHeader("x-rb-channel") String channel,
                                               @RestHeader("x-rb-region") String region,
                                               @RestHeader("x-rb-tenant") String tenant) {
        return stored(p.small(), varyMany);
    }

    // rb:wiring cache.*
    /**
     * The whole answer, so what @CacheResult stores carries the x-rb-serial it was written with. It
     * is a Uni because the interceptor waits for a plain return value by blocking, which the I/O
     * thread these handlers run on refuses, and it stores the item a Uni emits. The Vary header
     * tells a cache in front of the framework what the answer depends on. Quarkus's cache keys on
     * the arguments, not on this header.
     */
    private static Uni<RestResponse<Payload>> stored(Payload payload, String vary) {
        RestResponse.ResponseBuilder<Payload> answer = RestResponse.ResponseBuilder.ok(payload).header(Serial.HEADER, Serial.next());
        if (vary != null) {
            answer.header(HttpHeaders.VARY, vary);
        }
        return Uni.createFrom().item(answer.build());
    }
}

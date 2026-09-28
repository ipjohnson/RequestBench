package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.quarkus.cache.CacheResult;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.HttpHeaders;
import org.jboss.resteasy.reactive.RestHeader;
import org.jboss.resteasy.reactive.RestPath;
import org.jboss.resteasy.reactive.RestResponse;

/**
 * cache: Quarkus's cache, which stores what a @CacheResult method returned and returns it again
 * without running the method. A route's cache is keyed by the method's arguments, which are the key
 * in the path and, on the vary routes, the headers.
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
    @Path("small/{key}")
    @CacheResult(cacheName = "cache.small")
    public Uni<RestResponse<Payload>> small(@RestPath String key) {
        return stored(p.small(), null);
    }

    // rb:handler cache.medium
    @GET
    @Path("medium/{key}")
    @CacheResult(cacheName = "cache.medium")
    public Uni<RestResponse<Payload>> medium(@RestPath String key) {
        return stored(p.medium(), null);
    }

    // rb:handler cache.large
    @GET
    @Path("large/{key}")
    @CacheResult(cacheName = "cache.large")
    public Uni<RestResponse<Payload>> large(@RestPath String key) {
        return stored(p.large(), null);
    }

    // rb:handler cache.vary_one
    @GET
    @Path("vary/one/{key}")
    @CacheResult(cacheName = "cache.vary_one")
    public Uni<RestResponse<Payload>> varyOne(@RestPath String key, @RestHeader("x-rb-tenant") String tenant) {
        return stored(p.small(), varyOne);
    }

    // rb:handler cache.vary_many
    @GET
    @Path("vary/many/{key}")
    @CacheResult(cacheName = "cache.vary_many")
    public Uni<RestResponse<Payload>> varyMany(@RestPath String key,
                                               @RestHeader("x-rb-channel") String channel,
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

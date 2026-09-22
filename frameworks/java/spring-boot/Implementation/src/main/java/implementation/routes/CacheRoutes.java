package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * cache: Spring's cache abstraction, which stores what a @Cacheable method returned and returns
 * it again without running the method. Each handler returns the whole answer as a ResponseEntity,
 * so what is stored carries the x-rb-serial it was written with. A route's cache is keyed by the
 * method's arguments, and the vary routes take their headers as arguments for that reason.
 */
@RestController
public class CacheRoutes {

    private final Payloads p;

    private final String varyOne;

    private final String varyMany;

    CacheRoutes(Payloads p) {
        this.p = p;
        this.varyOne = String.join(", ", p.settings().cache().vary().one().keySet());
        this.varyMany = String.join(", ", p.settings().cache().vary().many().keySet());
    }

    @GetMapping("/cache/small")
    @Cacheable("cache.small")
    public ResponseEntity<Payload> small() {
        return stored(p.small(), null);
    }

    @GetMapping("/cache/medium")
    @Cacheable("cache.medium")
    public ResponseEntity<Payload> medium() {
        return stored(p.medium(), null);
    }

    @GetMapping("/cache/large")
    @Cacheable("cache.large")
    public ResponseEntity<Payload> large() {
        return stored(p.large(), null);
    }

    @GetMapping("/cache/vary/one")
    @Cacheable("cache.vary_one")
    public ResponseEntity<Payload> varyOne(@RequestHeader(name = "x-rb-tenant", required = false) String tenant) {
        return stored(p.small(), varyOne);
    }

    @GetMapping("/cache/vary/many")
    @Cacheable("cache.vary_many")
    public ResponseEntity<Payload> varyMany(@RequestHeader(name = "x-rb-channel", required = false) String channel,
                                            @RequestHeader(name = "x-rb-region", required = false) String region,
                                            @RequestHeader(name = "x-rb-tenant", required = false) String tenant) {
        return stored(p.small(), varyMany);
    }

    /**
     * The Vary header tells a cache in front of the framework what the answer depends on. Spring's
     * cache keys on the arguments, not on this header.
     */
    private static ResponseEntity<Payload> stored(Payload payload, String vary) {
        ResponseEntity.BodyBuilder answer = ResponseEntity.ok().header(Serial.HEADER, Serial.next());
        if (vary != null) {
            answer.header(HttpHeaders.VARY, vary);
        }
        return answer.body(payload);
    }
}

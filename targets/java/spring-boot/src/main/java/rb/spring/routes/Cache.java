package rb.spring.routes;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;

/**
 * cache: Spring's own cache abstraction.
 *
 * @Cacheable stores what the method returned and replays it without entering the body, and
 * the method returns a ResponseEntity, so what is stored is the whole response: status,
 * headers and payload. That is what makes x-rb-serial repeat across a run, and it is why
 * the counter is set inside the method rather than by a filter around it.
 *
 * The key is where a row says what it varies on. The path-keyed rows take the size as their
 * key and the vary rows take the header values, which arrive as parameters for that reason
 * alone: SpEL over #root.args is what Spring's own documentation reaches for.
 */
@RestController
public class Cache {

  // rb:wiring cache.*
  public static final String STORE = "rb-responses";

  // rb:wiring cache.*
  private static ResponseEntity<Object> serve(String size, String vary) {
    ResponseEntity.BodyBuilder b = ResponseEntity.ok()
        .header("x-rb-serial", Domain.nextSerial());
    if (vary != null) {
      b.header(HttpHeaders.VARY, vary);
    }
    return b.body(Domain.payload(size));
  }

  // rb:handler cache.small,cache.medium,cache.large
  @GetMapping("/cache/small")
  @Cacheable(cacheNames = STORE, key = "'/cache/small'")
  ResponseEntity<Object> small() {
    return serve("small", null);
  }

  @GetMapping("/cache/medium")
  @Cacheable(cacheNames = STORE, key = "'/cache/medium'")
  ResponseEntity<Object> medium() {
    return serve("medium", null);
  }

  @GetMapping("/cache/large")
  @Cacheable(cacheNames = STORE, key = "'/cache/large'")
  ResponseEntity<Object> large() {
    return serve("large", null);
  }

  // rb:handler cache.vary_one,cache.vary_many
  @GetMapping("/cache/vary/one")
  @Cacheable(cacheNames = STORE, key = "'/cache/vary/one|' + #tenant")
  ResponseEntity<Object> varyOne(
      @RequestHeader(value = "x-rb-tenant", required = false, defaultValue = "") String tenant) {
    return serve("small", String.join(", ", Domain.varyOn("one")));
  }

  @GetMapping("/cache/vary/many")
  @Cacheable(cacheNames = STORE,
             key = "'/cache/vary/many|' + #channel + '|' + #region + '|' + #tenant")
  ResponseEntity<Object> varyMany(
      @RequestHeader(value = "x-rb-channel", required = false, defaultValue = "") String channel,
      @RequestHeader(value = "x-rb-region", required = false, defaultValue = "") String region,
      @RequestHeader(value = "x-rb-tenant", required = false, defaultValue = "") String tenant) {
    return serve("small", String.join(", ", Domain.varyOn("many")));
  }
}

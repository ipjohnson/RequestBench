package rb.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

/**
 * The one ObjectMapper every target shares.
 *
 * Behaviour is shared, wiring is not: keeping the serializer library and its settings
 * identical everywhere means a difference between two targets is the framework's
 * integration with Jackson, not a different Jackson. A framework that brings its own
 * serializer (Micronaut defaults to micronaut-serde) keeps it, because that is a real
 * framework difference and belongs in the measurement.
 */
public final class Json {
  public static final ObjectMapper MAPPER = JsonMapper.builder().build();

  private Json() {}

  /** Compact UTF-8 bytes, which is what every target writes on the wire. */
  public static byte[] bytes(Object value) {
    try {
      return MAPPER.writeValueAsBytes(value);
    } catch (Exception e) {
      throw new IllegalStateException("serialize", e);
    }
  }
}

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

  private static final com.fasterxml.jackson.core.type.TypeReference<
      java.util.Map<String, Object>> BODY = new com.fasterxml.jackson.core.type.TypeReference<>() {};

  /** Compact UTF-8 bytes, which is what every target writes on the wire. */
  public static byte[] bytes(Object value) {
    try {
      return MAPPER.writeValueAsBytes(value);
    } catch (Exception e) {
      throw new IllegalStateException("serialize", e);
    }
  }

  /**
   * A request body as the plain Map the domain takes. Targets whose framework hands back
   * bytes or a string use this; the ones that can bind a Map themselves do that instead,
   * because the binding is part of what is being measured.
   */
  public static java.util.Map<String, Object> body(byte[] raw) {
    try {
      return MAPPER.readValue(raw, BODY);
    } catch (Exception e) {
      throw rb.domain.Errors.Validation.json();
    }
  }

  public static java.util.Map<String, Object> body(String raw) {
    try {
      return MAPPER.readValue(raw, BODY);
    } catch (Exception e) {
      throw rb.domain.Errors.Validation.json();
    }
  }
}

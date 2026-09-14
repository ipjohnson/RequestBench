package rb.baseline;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Json;
import rb.domain.Model.FieldError;

/**
 * A response before it has a transport.
 *
 * Routing returns one of these rather than writing to a socket, so the same routing serves
 * a Netty channel, a GCP HttpFunction and a Lambda event handler without any of them
 * wrapping another. A bare baseline has to be the floor for its host, not a translation of
 * another host's floor.
 *
 * The body is already bytes: every transport writes the same bytes, and serializing once
 * here keeps the measured difference between hosts in the host rather than in Jackson.
 */
public record Result(int status, Map<String, String> headers, byte[] body) {

  public static final String JSON = "application/json";
  public static final String TEXT = "text/plain";

  public static final Result NOT_FOUND = json(404, Map.of("error", "not_found"));

  public static Result json(int status, Object value) {
    return new Result(status, Map.of("content-type", JSON), Json.bytes(value));
  }

  public static Result text(int status, String body) {
    return new Result(status, Map.of("content-type", TEXT),
                      body.getBytes(StandardCharsets.UTF_8));
  }

  public static Result located(int status, Object value, String location) {
    Map<String, String> h = new LinkedHashMap<>(2);
    h.put("content-type", JSON);
    h.put("location", location);
    return new Result(status, h, Json.bytes(value));
  }

  /** 204 carries neither a type nor a length, which is what the header contract expects. */
  public static Result noContent() {
    return new Result(204, Map.of(), new byte[0]);
  }

  public static Result validationFailed(List<FieldError> errors) {
    Map<String, Object> body = new LinkedHashMap<>(2);
    body.put("error", "validation_failed");
    body.put("errors", errors);
    return json(422, body);
  }

  public static Result internal(String message) {
    Map<String, String> body = new LinkedHashMap<>(2);
    body.put("error", "internal");
    body.put("message", message);
    return json(500, body);
  }
}

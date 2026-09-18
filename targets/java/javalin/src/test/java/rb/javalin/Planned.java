package rb.javalin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.StreamSupport;

// rb:test *
/**
 * What a correct answer is, and which request asks for it.
 *
 * <p>Both come out of spec/. spec/expected.json is the only authority on a correct answer and
 * the conformance client is the only thing that judges a target against it, so a suite that
 * passes while {@code make test} fails this target is the suite that is wrong, and writing a
 * status or a body into a test as a literal is how the two drift apart. spec/plan.json is where
 * an order id, a query string and a request body come from.
 *
 * <p>Instance zero, always. An endpoint sends up to 512 requests and the conformance client
 * replays every one; a suite sends one, so it has to be the same one on every run or a failure
 * would not reproduce.
 */
final class Planned {
  private Planned() {}

  /** The repository root, which is where spec/ is. Surefire runs from the module. */
  static final Path ROOT = findRoot();

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final JsonNode PLAN = read("plan.json");
  private static final JsonNode EXPECTED = read("expected.json");

  /**
   * One of an endpoint's requests, and the answer pinned for it. {@code want} is null for an
   * error endpoint: its envelope is the framework's own contract, and Envelope rather than
   * Floor is what judges it.
   */
  record Ask(String id, String key, String method, String path, Map<String, String> headers,
             String body, JsonNode want) {}

  static Ask ask(String id) {
    JsonNode ep = StreamSupport.stream(PLAN.get("endpoints").spliterator(), false)
        .filter(e -> e.get("id").asText().equals(id)).findFirst().orElseThrow();
    String path = ep.get("paths").get(0).asText();
    Map<String, String> headers = new LinkedHashMap<>();
    ep.path("headers").properties().forEach(e -> headers.put(e.getKey(), e.getValue().asText()));
    // A vary row sends a different header set per instance, which is what the response cache
    // is keyed on. Instance zero, for the reason above.
    if (ep.path("header_variants").size() > 0) {
      ep.get("header_variants").get(0).properties()
          .forEach(e -> headers.put(e.getKey(), e.getValue().asText()));
    }
    String body = ep.hasNonNull("body") ? ep.get("body").asText() : null;
    if (body != null) {
      headers.put("content-type", "application/json");
    }
    String key = id + " " + path;
    JsonNode want = EXPECTED.get("errors").has(id) ? null : EXPECTED.get("requests").get(key);
    return new Ask(id, key, ep.get("method").asText(), path, headers, body, want);
  }

  /**
   * The request a validator is taken from, as method, path and header, for the one endpoint
   * that needs one first. etag.match_large carries {capture.etag_large} in its if-none-match,
   * which only the target can produce.
   */
  static String[] captureFor(Ask a) {
    for (String value : a.headers().values()) {
      if (value.startsWith("{capture.")) {
        JsonNode c = PLAN.get("captures").get(value.substring(9, value.length() - 1));
        return new String[] {c.get("method").asText(), c.get("path").asText(), c.get("header").asText()};
      }
    }
    throw new IllegalStateException(a.id() + " captures nothing");
  }

  /** The same headers with the capture's placeholder replaced by what was captured. */
  static Map<String, String> resolved(Ask a, String captured) {
    Map<String, String> out = new LinkedHashMap<>();
    a.headers().forEach((k, v) -> out.put(k, v.startsWith("{capture.") ? captured : v));
    return out;
  }

  /** The error envelope this target recorded, as status, body class and shape, or null. */
  static JsonNode envelope(String target, String key) {
    JsonNode t = EXPECTED.get("targets").get(target);
    return t == null ? null : t.get(key);
  }

  static JsonNode parse(byte[] raw) throws IOException {
    return MAPPER.readTree(raw);
  }

  private static JsonNode read(String name) {
    try {
      return MAPPER.readTree(ROOT.resolve("spec").resolve(name).toFile());
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static Path findRoot() {
    Path at = Path.of("").toAbsolutePath();
    while (!Files.exists(at.resolve("spec").resolve("expected.json"))) {
      at = at.getParent();
    }
    return at;
  }
}
// rb:end

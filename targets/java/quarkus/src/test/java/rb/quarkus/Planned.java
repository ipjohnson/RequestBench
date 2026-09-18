package rb.quarkus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.IntNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
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
 *
 * <p>A {@code {run.<name>}} placeholder is the exception. It stands for a value no target may
 * know in advance, so this draws its own when it reads the plan.
 */
final class Planned {
  private Planned() {}

  /** The repository root, which is where spec/ is. Surefire runs from the module. */
  static final Path ROOT = findRoot();

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final JsonNode PLAN = read("plan.json");
  private static final JsonNode EXPECTED = read("expected.json");
  private static final Map<String, JsonNode> VALUES = draw(PLAN.get("run_values"));
  private static final Pattern RUN = Pattern.compile("\\{run\\.([a-z_]+)\\}");

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
    headers.replaceAll((name, value) -> inHeader(value));
    String body = ep.hasNonNull("body") ? ep.get("body").asText() : null;
    if (body != null) {
      headers.put("content-type", "application/json");
    }
    // Keyed by the path as the plan writes it, with any {run.<name>} still in it, because the
    // path that is sent changes every run.
    String key = id + " " + path;
    JsonNode want = EXPECTED.get("errors").has(id) ? null : pinned(key);
    return new Ask(id, key, ep.get("method").asText(), inPath(path), headers, body, want);
  }

  /** The answer pinned for a key, as a copy with this run's values in its body. */
  private static JsonNode pinned(String key) {
    ObjectNode copy = EXPECTED.get("requests").get(key).deepCopy();
    copy.set("body", filled(copy.get("body")));
    return copy;
  }

  /**
   * A path from the plan with this run's values in it, percent-encoded. URLEncoder writes a
   * space as +, which RFC 3986 does not read as a space, so it goes as %20.
   */
  private static String inPath(String path) {
    return RUN.matcher(path).replaceAll(m ->
        URLEncoder.encode(value(m.group(1)).asText(), StandardCharsets.UTF_8).replace("+", "%20"));
  }

  /** A header value from the plan with this run's values in it, as they are. */
  private static String inHeader(String header) {
    return RUN.matcher(header)
        .replaceAll(m -> Matcher.quoteReplacement(value(m.group(1)).asText()));
  }

  /**
   * A body with every string that is a whole {@code {run.<name>}} replaced by its value, in
   * place. spec/expected.json holds each as a string, and an int goes back in as the number it
   * is.
   */
  private static JsonNode filled(JsonNode body) {
    if (body.isTextual()) {
      Matcher m = RUN.matcher(body.textValue());
      return m.matches() ? value(m.group(1)) : body;
    }
    if (body instanceof ArrayNode items) {
      for (int i = 0; i < items.size(); i++) {
        items.set(i, filled(items.get(i)));
      }
    } else if (body.isObject()) {
      body.properties().forEach(e -> e.setValue(filled(e.getValue())));
    }
    return body;
  }

  private static JsonNode value(String name) {
    JsonNode v = VALUES.get(name);
    if (v == null) {
      throw new IllegalStateException("no value was drawn for {run." + name + "}");
    }
    return v;
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

  /** One value for each declaration: an int as a number, anything else as a string. */
  private static Map<String, JsonNode> draw(JsonNode declared) {
    SecureRandom random = new SecureRandom();
    Map<String, JsonNode> out = new LinkedHashMap<>();
    declared.properties().forEach(e -> {
      JsonNode rule = e.getValue();
      out.put(e.getKey(), switch (rule.get("kind").asText()) {
        case "int" -> {
          int low = (int) Math.pow(10, rule.get("digits").asInt() - 1);
          yield IntNode.valueOf(random.nextInt(low, low * 10));
        }
        case "string" -> TextNode.valueOf(text(random, rule));
        case "words" -> TextNode.valueOf(Stream.generate(() -> text(random, rule))
            .limit(rule.get("count").asInt()).collect(Collectors.joining(" ")));
        case "choice" -> rule.get("values").get(random.nextInt(rule.get("values").size()));
        default -> throw new IllegalStateException(e.getKey() + " is of kind " + rule.get("kind"));
      });
    });
    return out;
  }

  /** {@code length} characters, each drawn from {@code chars}. */
  private static String text(SecureRandom random, JsonNode rule) {
    String chars = rule.get("chars").asText();
    return random.ints(rule.get("length").asInt(), 0, chars.length())
        .mapToObj(i -> String.valueOf(chars.charAt(i))).collect(Collectors.joining());
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

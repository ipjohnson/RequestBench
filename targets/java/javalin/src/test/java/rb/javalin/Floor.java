package rb.javalin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeSet;
import java.util.zip.GZIPInputStream;

// rb:test *
/**
 * What every test asserts before it asserts anything of its own.
 *
 * <p>A port of difference() in client/src/expectation.ts, in its order and with its rules. The
 * order is the point: a target answering the right values as text/plain is not answering
 * correctly, so the kind of body is checked before the body. A suite stricter than the client
 * fails a target the client passes, and a looser one passes a target {@code make test} rejects.
 */
final class Floor {
  private Floor() {}

  /** What came back: the status, the two headers the floor reads, the body and the rest. */
  record Answer(int status, String contentType, String encoding, byte[] raw,
                Map<String, String> headers) {}

  /** Assert the pinned answer, or fail naming the first thing that differs. */
  static void check(Planned.Ask a, Answer answer) {
    String why = difference(a.want(), answer);
    if (why != null) {
      throw new AssertionError(a.key() + ": " + why);
    }
  }

  static String difference(JsonNode want, Answer answer) {
    if (answer.status() != want.get("status").asInt()) {
      return "expected " + want.get("status").asInt() + ", got " + answer.status();
    }
    // A null is a field spec/expected.json deliberately does not pin; its "unpinned" block
    // says which. compressed.gzip_small is the one this suite meets.
    String got = bodyClass(answer.contentType());
    if (!want.get("body_class").isNull() && !got.equals(want.get("body_class").asText())) {
      return "expected a " + want.get("body_class").asText() + " body, got " + got;
    }
    if (!want.get("encoding").isNull() && !answer.encoding().equals(want.get("encoding").asText())) {
      return "expected content-encoding " + named(want.get("encoding").asText()) + ", got "
          + named(answer.encoding());
    }
    return firstDifference(comparable(decoded(answer), answer.contentType()), want.get("body"),
                           "response");
  }

  static String bodyClass(String contentType) {
    String ctype = contentType == null ? "" : contentType.toLowerCase();
    if (ctype.contains("json")) return "json";
    if (ctype.contains("html")) return "html";
    if (ctype.contains("text")) return "text";
    return ctype.isEmpty() ? "none" : "other";
  }

  private static String named(String encoding) {
    return encoding.isEmpty() ? "identity" : encoding;
  }

  /**
   * gzip output differs between zlib, Java's Deflater and Go's compress/flate at the same
   * level. The decompressed bytes must not, so the comparison is taken over those.
   */
  private static byte[] decoded(Answer answer) {
    if (answer.raw().length == 0 || !answer.encoding().contains("gzip")) {
      return answer.raw();
    }
    try (GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(answer.raw()))) {
      return in.readAllBytes();
    } catch (IOException e) {
      return answer.raw();
    }
  }

  /** The response as a value rather than as bytes, so key order and 18928.0 stop mattering. */
  private static JsonNode comparable(byte[] raw, String contentType) {
    if (raw.length == 0) return null;
    String ctype = contentType == null ? "" : contentType;
    if (ctype.contains("json")) {
      try {
        return Planned.parse(raw);
      } catch (IOException e) {
        return TextNode.valueOf("unparseable-json");
      }
    }
    String text = new String(raw, StandardCharsets.UTF_8);
    if (ctype.contains("html")) {
      // Five template engines cannot agree on formatting, so the spec pins content and leaves
      // whitespace free: same elements, same order, same values.
      text = text.replaceAll("[ \\t\\n\\r\\f\\x0B]+", " ").replaceAll("> +", ">")
                 .replaceAll(" +<", "<").trim();
    }
    return TextNode.valueOf(text);
  }

  private static String typeName(JsonNode v) {
    if (v == null || v.isNull()) return "NoneType";
    if (v.isArray()) return "list";
    if (v.isObject()) return "dict";
    if (v.isTextual()) return "str";
    if (v.isBoolean()) return "bool";
    if (v.isNumber()) return v.decimalValue().stripTrailingZeros().scale() <= 0 ? "int" : "float";
    return v.getNodeType().name().toLowerCase();
  }

  static String firstDifference(JsonNode a, JsonNode b, String path) {
    String ta = typeName(a), tb = typeName(b);
    boolean bothNumbers = a != null && b != null && a.isNumber() && b.isNumber();
    if (!ta.equals(tb) && !bothNumbers) return path + ": " + ta + " vs " + tb;
    if (a == null || a.isNull()) return null;
    if (a.isObject()) {
      TreeSet<String> keys = new TreeSet<>();
      a.fieldNames().forEachRemaining(keys::add);
      b.fieldNames().forEachRemaining(keys::add);
      for (String k : keys) {
        if (!a.has(k)) return path + "." + k + ": missing here, present in the reference";
        if (!b.has(k)) return path + "." + k + ": present here, missing in the reference";
        String d = firstDifference(a.get(k), b.get(k), path + "." + k);
        if (d != null) return d;
      }
      return null;
    }
    if (a.isArray()) {
      if (a.size() != b.size()) return path + ": " + a.size() + " items vs " + b.size();
      for (int i = 0; i < a.size(); i++) {
        String d = firstDifference(a.get(i), b.get(i), path + "[" + i + "]");
        if (d != null) return d;
      }
      return null;
    }
    if (bothNumbers) {
      return a.decimalValue().compareTo(b.decimalValue()) == 0 ? null : path + ": " + a + " vs " + b;
    }
    return a.equals(b) ? null : path + ": " + a + " vs " + b;
  }
}
// rb:end

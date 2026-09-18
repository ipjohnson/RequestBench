package rb.javalin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

// rb:test authorized.*,body.*,errors.*
/**
 * What an error endpoint has to answer, which is not what a 2xx endpoint has to answer.
 *
 * <p>A 2xx body is the controlled variable and spec/expected.json pins it exactly. An error
 * envelope is the framework's own contract, so what is held is the status, the kind of body,
 * and the shape this target recorded: the envelope with the values taken out.
 *
 * <p>The framework-agnostic {@code errors} block is deliberately not what this reads. That block
 * says what the plan intends, and a framework may declare otherwise in the client-exception
 * package beside it, which the conformance client reads. A suite reads what this target
 * recorded instead.
 */
final class Envelope {
  private Envelope() {}

  static void check(Planned.Ask a, Floor.Answer answer, String target) {
    JsonNode recorded = Planned.envelope(target, a.key());
    if (recorded == null) {
      throw new AssertionError(a.key() + ": spec/expected.json records no envelope for " + target);
    }
    if (answer.status() != recorded.get("status").asInt()) {
      throw new AssertionError(a.key() + ": expected " + recorded.get("status") + ", got " + answer.status());
    }
    String got = Floor.bodyClass(answer.contentType());
    if (!got.equals(recorded.get("body_class").asText())) {
      throw new AssertionError(a.key() + ": expected a " + recorded.get("body_class").asText()
                               + " body, got " + got);
    }
    JsonNode body;
    try {
      body = answer.raw().length == 0 ? null : Planned.parse(answer.raw());
    } catch (IOException e) {
      body = TextNode.valueOf("unparseable-json");
    }
    Set<String> have = shapeOf(body, ""), want = new TreeSet<>();
    recorded.get("shape").forEach(s -> want.add(s.asText()));
    if (!have.equals(want)) {
      Set<String> missing = new TreeSet<>(want), added = new TreeSet<>(have);
      missing.removeAll(have);
      added.removeAll(want);
      throw new AssertionError(a.key() + ": the envelope shape moved: missing " + missing
                               + ", added " + added);
    }
  }

  /** A port of shape_of() in harness/expected.py, which is what wrote the recorded shapes. */
  static Set<String> shapeOf(JsonNode node, String path) {
    Set<String> out = new TreeSet<>();
    if (node != null && node.isObject()) {
      if (node.isEmpty()) {
        out.add(path + "{}");
      }
      for (Iterator<Map.Entry<String, JsonNode>> it = node.fields(); it.hasNext(); ) {
        Map.Entry<String, JsonNode> e = it.next();
        out.addAll(shapeOf(e.getValue(), path.isEmpty() ? e.getKey() : path + "." + e.getKey()));
      }
    } else if (node != null && node.isArray()) {
      if (node.isEmpty()) {
        out.add(path + "[]");
      }
      node.forEach(v -> out.addAll(shapeOf(v, path + "[]")));
    } else {
      String kind = node == null || node.isNull() ? "null" : node.isTextual() ? "string"
          : node.isBoolean() ? "bool" : node.isNumber() ? "number" : "other";
      out.add(path + ":" + kind);
    }
    return out;
  }
}
// rb:end

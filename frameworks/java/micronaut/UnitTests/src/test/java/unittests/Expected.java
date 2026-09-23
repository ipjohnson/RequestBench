package unittests;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import io.micronaut.json.JsonMapper;
import io.micronaut.json.tree.JsonNode;

/** What an answer has to be, read from the committed payloads. */
final class Expected {

    static final JsonMapper JSON = JsonMapper.createDefault();

    private static final Path DIRECTORY = find();

    private Expected() {}

    /** The directory RB_PAYLOADS names, or tests/payloads found by walking up from the module. */
    static String directory() {
        return DIRECTORY.toString();
    }

    static byte[] bytes(String file) {
        try {
            return Files.readAllBytes(DIRECTORY.resolve(file));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static JsonNode parse(byte[] json) {
        try {
            return JSON.readValue(json, JsonNode.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static JsonNode json(String file) {
        return parse(bytes(file));
    }

    static JsonNode settings() {
        return json("settings.json");
    }

    /** An object of these names and values, each value a JsonNode, a string, a number or a boolean. */
    static JsonNode object(Object... pairs) {
        Map<String, JsonNode> fields = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            fields.put((String) pairs[i], pairs[i + 1] instanceof JsonNode node ? node : JsonNode.from(pairs[i + 1]));
        }
        return JsonNode.createObjectNode(fields);
    }

    /** The object with these fields set, added or replaced. */
    static JsonNode with(JsonNode object, JsonNode fields) {
        Map<String, JsonNode> merged = new LinkedHashMap<>();
        object.entries().forEach(e -> merged.put(e.getKey(), e.getValue()));
        fields.entries().forEach(e -> merged.put(e.getKey(), e.getValue()));
        return JsonNode.createObjectNode(merged);
    }

    /** A payload with an echo object beside its own fields, as a binding handler answers. */
    static JsonNode withEcho(String file, JsonNode echo) {
        return with(json(file), object("echo", echo));
    }

    /** One row of items.large. */
    static JsonNode row(int id) {
        return json("items.large.json").get("items").get(id - 1);
    }

    /** The page the template rows render, as tests/payloads/index.ts writes it. */
    static String page(String file) {
        JsonNode payload = json(file);
        StringBuilder rows = new StringBuilder();
        for (JsonNode it : payload.get("items").values()) {
            rows.append("<tr><td>").append(it.get("id").getIntValue()).append("</td><td>").append(it.get("name").getStringValue())
                .append("</td><td>").append(it.get("category").getStringValue()).append("</td><td>").append(it.get("priceCents").getIntValue())
                .append("</td><td>").append(it.get("inStock").getBooleanValue() ? "yes" : "no").append("</td></tr>");
        }
        return "<!doctype html><html><head><title>items</title></head><body>"
            + "<h1>" + payload.get("size").getStringValue() + "</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>"
            + "<tbody>" + rows + "</tbody></table><p>" + payload.get("count").getIntValue() + " rows</p></body></html>";
    }

    /** Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a page. */
    static String normal(String html) {
        return html.replaceAll("[ \\t\\n\\r\\f\\x0B]+", " ").replaceAll(">[ ]+", ">").replaceAll("[ ]+<", "<").trim();
    }

    private static Path find() {
        String named = System.getenv("RB_PAYLOADS");
        if (named != null && !named.isEmpty()) {
            return Path.of(named).toAbsolutePath().normalize();
        }
        for (Path dir = Path.of("").toAbsolutePath(); dir != null; dir = dir.getParent()) {
            Path candidate = dir.resolve("tests").resolve("payloads");
            if (Files.exists(candidate.resolve("items.large.json"))) {
                return candidate;
            }
        }
        throw new IllegalStateException("RB_PAYLOADS is not set and there is no tests/payloads above " + Path.of("").toAbsolutePath());
    }
}

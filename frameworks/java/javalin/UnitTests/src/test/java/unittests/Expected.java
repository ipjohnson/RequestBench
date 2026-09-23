package unittests;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** What an answer has to be, read from the committed payloads. */
final class Expected {

    static final ObjectMapper JSON = new ObjectMapper();

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

    static String text(String file) {
        return new String(bytes(file), StandardCharsets.UTF_8);
    }

    static JsonNode json(String file) {
        try {
            return JSON.readTree(bytes(file));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static JsonNode settings() {
        return json("settings.json");
    }

    /** A payload with an echo object beside its own fields, as a binding handler answers. */
    static JsonNode withEcho(String file, ObjectNode echo) {
        ObjectNode payload = (ObjectNode) json(file);
        payload.set("echo", echo);
        return payload;
    }

    /** One row of items.large. */
    static ObjectNode row(int id) {
        return (ObjectNode) json("items.large.json").get("items").get(id - 1).deepCopy();
    }

    /** The page the template rows render, as tests/payloads/index.ts writes it. */
    static String page(String file) {
        JsonNode payload = json(file);
        StringBuilder rows = new StringBuilder();
        for (JsonNode it : payload.get("items")) {
            rows.append("<tr><td>").append(it.get("id").asInt()).append("</td><td>").append(it.get("name").asText())
                .append("</td><td>").append(it.get("category").asText()).append("</td><td>").append(it.get("priceCents").asInt())
                .append("</td><td>").append(it.get("inStock").asBoolean() ? "yes" : "no").append("</td></tr>");
        }
        return "<!doctype html><html><head><title>items</title></head><body>"
            + "<h1>" + payload.get("size").asText() + "</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>"
            + "<tbody>" + rows + "</tbody></table><p>" + payload.get("count").asInt() + " rows</p></body></html>";
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

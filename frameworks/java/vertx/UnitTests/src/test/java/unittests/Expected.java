package unittests;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;

/** What an answer has to be, read from the committed payloads. */
final class Expected {

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

    static JsonObject json(String file) {
        return Buffer.buffer(bytes(file)).toJsonObject();
    }

    static JsonObject settings() {
        return json("settings.json");
    }

    /** A payload with an echo object beside its own fields, as a binding handler answers. */
    static JsonObject withEcho(String file, JsonObject echo) {
        return json(file).put("echo", echo);
    }

    /** One row of items.large. */
    static JsonObject row(int id) {
        return json("items.large.json").getJsonArray("items").getJsonObject(id - 1);
    }

    /** The page the template rows render, as tests/payloads/index.ts writes it. */
    static String page(String file) {
        JsonObject payload = json(file);
        StringBuilder rows = new StringBuilder();
        for (Object item : payload.getJsonArray("items")) {
            JsonObject it = (JsonObject) item;
            rows.append("<tr><td>").append(it.getInteger("id")).append("</td><td>").append(it.getString("name"))
                .append("</td><td>").append(it.getString("category")).append("</td><td>").append(it.getInteger("priceCents"))
                .append("</td><td>").append(it.getBoolean("inStock") ? "yes" : "no").append("</td></tr>");
        }
        return "<!doctype html><html><head><title>items</title></head><body>"
            + "<h1>" + payload.getString("size") + "</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>"
            + "<tbody>" + rows + "</tbody></table><p>" + payload.getInteger("count") + " rows</p></body></html>";
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

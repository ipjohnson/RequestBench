package implementation;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

/**
 * The committed payloads, read from the directory RB_PAYLOADS names before Vert.x starts, so a
 * missing or broken file stops the boot rather than failing a request. They are kept as Vert.x's
 * JsonObject, which every event loop reads and none writes, and encoded on every request.
 */
public final class Payloads {

    private final Path directory;

    private final JsonObject small;

    private final JsonObject medium;

    private final JsonObject large;

    private final JsonObject settings;

    private final Map<Integer, JsonObject> rows = new HashMap<>();

    private Payloads(Path directory) throws IOException {
        this.directory = directory.toAbsolutePath().normalize();
        this.small = read("items.small.json");
        this.medium = read("items.medium.json");
        this.large = read("items.large.json");
        this.settings = read("settings.json");
        JsonArray items = large.getJsonArray("items");
        for (int i = 0; i < items.size(); i++) {
            JsonObject row = items.getJsonObject(i);
            rows.put(row.getInteger("id"), row);
        }
    }

    public static Payloads load(String directory) throws IOException {
        return new Payloads(Path.of(directory));
    }

    public String directory() {
        return directory.toString();
    }

    public JsonObject small() {
        return small;
    }

    public JsonObject medium() {
        return medium;
    }

    public JsonObject large() {
        return large;
    }

    /** The values the framework configures itself from, as settings.json holds them. */
    public JsonObject settings() {
        return settings;
    }

    /** The row of items.large with this id, or null when there is none. */
    public JsonObject row(int id) {
        return rows.get(id);
    }

    /** A payload with the values a handler bound written back beside its own fields. */
    public static JsonObject echoed(JsonObject payload, JsonObject echo) {
        return new JsonObject()
                .put("size", payload.getValue("size"))
                .put("count", payload.getValue("count"))
                .put("items", payload.getValue("items"))
                .put("echo", echo);
    }

    private JsonObject read(String file) throws IOException {
        return Buffer.buffer(Files.readAllBytes(directory.resolve(file))).toJsonObject();
    }
}

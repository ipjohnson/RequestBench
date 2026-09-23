package implementation;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The committed payloads, read from the directory RB_PAYLOADS names before the server starts, so
 * a missing or broken file stops the boot rather than failing a request. The parsed objects are
 * kept and serialised on every request.
 */
public final class Payloads {

    private final Path directory;

    private final Payload small;

    private final Payload medium;

    private final Payload large;

    private final Settings settings;

    private final Map<Integer, Item> rows;

    private Payloads(Path directory) throws IOException {
        ObjectMapper json = new ObjectMapper();
        this.directory = directory.toAbsolutePath().normalize();
        this.small = read(json, "items.small.json", Payload.class);
        this.medium = read(json, "items.medium.json", Payload.class);
        this.large = read(json, "items.large.json", Payload.class);
        this.settings = read(json, "settings.json", Settings.class);
        this.rows = large.items().stream().collect(Collectors.toUnmodifiableMap(Item::id, Function.identity()));
    }

    public static Payloads load(Path directory) throws IOException {
        return new Payloads(directory);
    }

    public Path directory() {
        return directory;
    }

    public Payload small() {
        return small;
    }

    public Payload medium() {
        return medium;
    }

    public Payload large() {
        return large;
    }

    public Settings settings() {
        return settings;
    }

    /** The row of items.large with this id, or null when there is none. */
    public Item row(int id) {
        return rows.get(id);
    }

    private <T> T read(ObjectMapper json, String file, Class<T> type) throws IOException {
        return json.readValue(Files.readAllBytes(directory.resolve(file)), type);
    }
}

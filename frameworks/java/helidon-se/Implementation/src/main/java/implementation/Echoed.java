package implementation;

import java.util.List;

import io.helidon.json.binding.Json;

/**
 * A payload with the values a handler bound written back beside its own fields. The echo is an
 * Object, which Helidon JSON Binding writes with the converter of its runtime type, because its
 * annotation processor writes a converter for a generic record that does not compile.
 */
@Json.Entity
public record Echoed(String size, int count, List<Item> items, Object echo) {

    public static Echoed of(Payload payload, Object echo) {
        return new Echoed(payload.size(), payload.count(), payload.items(), echo);
    }
}

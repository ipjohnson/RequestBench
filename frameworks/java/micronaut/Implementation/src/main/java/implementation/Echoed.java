package implementation;

import java.util.List;

import io.micronaut.serde.annotation.Serdeable;

/** A payload with the values a handler bound written back beside its own fields. */
@Serdeable
public record Echoed<T>(String size, int count, List<Item> items, T echo) {

    public static <T> Echoed<T> of(Payload payload, T echo) {
        return new Echoed<>(payload.size(), payload.count(), payload.items(), echo);
    }
}

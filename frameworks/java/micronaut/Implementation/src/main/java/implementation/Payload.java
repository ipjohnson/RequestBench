package implementation;

import java.util.List;

import io.micronaut.serde.annotation.Serdeable;

/** items.small, items.medium or items.large. */
@Serdeable
public record Payload(String size, int count, List<Item> items) {}

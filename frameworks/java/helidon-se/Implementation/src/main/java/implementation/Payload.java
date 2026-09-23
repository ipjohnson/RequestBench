package implementation;

import java.util.List;

import io.helidon.json.binding.Json;

/** items.small, items.medium or items.large. */
@Json.Entity
public record Payload(String size, int count, List<Item> items) {}

package implementation;

import io.helidon.json.binding.Json;

/** One row of items.large, and of every payload made from it. */
@Json.Entity
public record Item(int id, String name, String category, int priceCents, boolean inStock) {}

package implementation;

import io.micronaut.serde.annotation.Serdeable;

/** One row of items.large, and of every payload made from it. */
@Serdeable
public record Item(int id, String name, String category, int priceCents, boolean inStock) {}

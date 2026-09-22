package implementation;

/** One row of items.large, and of every payload made from it. */
public record Item(int id, String name, String category, int priceCents, boolean inStock) {}

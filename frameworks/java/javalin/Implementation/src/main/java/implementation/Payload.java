package implementation;

import java.util.List;

/** items.small, items.medium or items.large. */
public record Payload(String size, int count, List<Item> items) {}

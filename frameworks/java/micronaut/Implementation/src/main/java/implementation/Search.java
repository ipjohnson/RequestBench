package implementation;

import io.micronaut.serde.annotation.Serdeable;

/** query.many's eight values, which forms.urlencoded posts as a form. */
@Serdeable
public record Search(int page, int size, String status, String category, String sort, String q, int minPrice, int maxPrice) {}

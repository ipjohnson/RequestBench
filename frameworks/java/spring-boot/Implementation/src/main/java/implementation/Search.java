package implementation;

/** query.many's eight values, which forms.urlencoded posts as a form. */
public record Search(int page, int size, String status, String category, String sort, String q, int minPrice, int maxPrice) {}

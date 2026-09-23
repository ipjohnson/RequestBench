package implementation;

import io.helidon.common.parameters.Parameters;
import io.helidon.json.binding.Json;

/** query.many's eight values, which forms.urlencoded posts as a form. */
@Json.Entity
public record Search(int page, int size, String status, String category, String sort, String q, int minPrice, int maxPrice) {

    /** The eight values read by name, from a query string or a form, which Helidon parses into the same Parameters. */
    public static Search of(Parameters values) {
        return new Search(values.first("page").asInt().get(), values.first("size").asInt().get(), values.first("status").get(),
                values.first("category").get(), values.first("sort").get(), values.first("q").get(),
                values.first("minPrice").asInt().get(), values.first("maxPrice").asInt().get());
    }
}

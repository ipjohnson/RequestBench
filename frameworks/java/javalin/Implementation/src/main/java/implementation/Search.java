package implementation;

import io.javalin.validation.Validator;

/** query.many's eight values, which forms.urlencoded posts as a form. */
public record Search(int page, int size, String status, String category, String sort, String q, int minPrice, int maxPrice) {

    /**
     * The request's values by name: ctx::queryParamAsClass for the query string, or
     * ctx::formParamAsClass for a form. Each returns Javalin's Validator, which converts the value
     * with its converter for the type and refuses one it cannot convert with 400.
     */
    @FunctionalInterface
    public interface Source {
        <T> Validator<T> value(String name, Class<T> type);
    }

    public static Search bind(Source values) {
        return new Search(
                values.value("page", Integer.class).get(),
                values.value("size", Integer.class).get(),
                values.value("status", String.class).get(),
                values.value("category", String.class).get(),
                values.value("sort", String.class).get(),
                values.value("q", String.class).get(),
                values.value("minPrice", Integer.class).get(),
                values.value("maxPrice", Integer.class).get());
    }
}

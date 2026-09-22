package unittests;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.node.ObjectNode;

class QueryTests extends SpringApp {

    /** query.many's eight values, as a run might draw them. */
    static final Map<String, String> SEARCH = search();

    private static final Set<String> NUMBERS = Set.of("page", "size", "minPrice", "maxPrice");

    // rb:test query.one
    @Test
    @Tag("query.one")
    void oneValueIsBoundAsAnInteger() throws Exception {
        ObjectNode echo = Expected.JSON.createObjectNode().put("page", 417);

        Answer.is(Expected.withEcho("items.small.json", echo), get("/query/one?page=417"));
    }

    // rb:test query.many
    @Test
    @Tag("query.many")
    void eightValuesAreBoundIntoARecord() throws Exception {
        String query = SEARCH.entrySet().stream()
            .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8).replace("+", "%20"))
            .collect(Collectors.joining("&"));

        Answer.is(Expected.withEcho("items.small.json", searchEcho()), get("/query/many?" + query));
    }

    /** The echo a handler that bound SEARCH answers with, the numbers as numbers. */
    static ObjectNode searchEcho() {
        ObjectNode echo = Expected.JSON.createObjectNode();
        SEARCH.forEach((name, value) -> {
            if (NUMBERS.contains(name)) {
                echo.put(name, Integer.parseInt(value));
            } else {
                echo.put(name, value);
            }
        });
        return echo;
    }

    private static Map<String, String> search() {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("page", "417");
        values.put("size", "38");
        values.put("status", "paid");
        values.put("category", "garden");
        values.put("sort", "created");
        values.put("q", "alpha bravo");
        values.put("minPrice", "1200");
        values.put("maxPrice", "34000");
        return values;
    }
}

package implementation;

import java.util.List;
import java.util.Map;

import io.helidon.json.binding.Json;

/** The values the framework configures itself from, as settings.json holds them. */
@Json.Entity
public record Settings(String token, String wrongToken, String staleEtag, Cache cache, Cors cors) {

    @Json.Entity
    public record Cache(int capacity, int ttlSeconds, Vary vary) {}

    /** The values each vary row is keyed on, by header. */
    @Json.Entity
    public record Vary(Map<String, List<String>> one, Map<String, List<String>> many) {}

    @Json.Entity
    public record Cors(String origin, String method, String header, int maxAgeSeconds) {}
}

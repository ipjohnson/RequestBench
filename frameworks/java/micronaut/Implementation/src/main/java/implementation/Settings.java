package implementation;

import java.util.List;
import java.util.Map;

import io.micronaut.serde.annotation.Serdeable;

/** The values the framework configures itself from, as settings.json holds them. */
@Serdeable
public record Settings(String token, String wrongToken, String staleEtag, Cache cache, Cors cors) {

    @Serdeable
    public record Cache(int capacity, int ttlSeconds, Vary vary) {}

    /** The values each vary row is keyed on, by header. */
    @Serdeable
    public record Vary(Map<String, List<String>> one, Map<String, List<String>> many) {}

    @Serdeable
    public record Cors(String origin, String method, String header, int maxAgeSeconds) {}
}

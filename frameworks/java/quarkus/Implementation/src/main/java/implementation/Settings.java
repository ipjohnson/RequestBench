package implementation;

import java.util.List;
import java.util.Map;

import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * The values the framework configures itself from, as settings.json holds them. Jackson reads it
 * in Payloads, outside any resource method, so a native image needs it and its nested records
 * registered for reflection.
 */
@RegisterForReflection
public record Settings(String token, String wrongToken, String staleEtag, Cache cache, Cors cors) {

    public record Cache(int capacity, int ttlSeconds, Vary vary) {}

    /** The values each vary row is keyed on, by header. */
    public record Vary(Map<String, List<String>> one, Map<String, List<String>> many) {}

    public record Cors(String origin, String method, String header, int maxAgeSeconds) {}
}

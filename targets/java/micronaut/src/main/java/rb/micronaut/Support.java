package rb.micronaut;

import io.micronaut.http.HttpRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What more than one controller needs from a Micronaut request. */
public final class Support {
  private Support() {}

  public static Map<String, List<String>> query(HttpRequest<?> request) {
    Map<String, List<String>> out = new LinkedHashMap<>();
    request.getParameters().forEach(e -> out.put(e.getKey(), e.getValue()));
    return out;
  }
}

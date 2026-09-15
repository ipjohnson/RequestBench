package rb.spring;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What more than one controller needs. */
public final class Support {
  private Support() {}

  /** Spring binds a query string as one value per name; the domain takes net/http's shape. */
  public static Map<String, List<String>> query(Map<String, String> flat) {
    Map<String, List<String>> out = new LinkedHashMap<>(flat.size());
    flat.forEach((k, v) -> out.put(k, List.of(v)));
    return out;
  }
}

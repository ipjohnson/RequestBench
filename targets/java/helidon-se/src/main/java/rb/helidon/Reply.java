package rb.helidon;

import io.helidon.common.parameters.Parameters;
import io.helidon.webserver.http.ServerRequest;
import io.helidon.webserver.http.ServerResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Errors;

/** What more than one family needs from a Helidon request. */
public final class Reply {
  private Reply() {}

  public static Map<String, List<String>> query(ServerRequest req) {
    Parameters p = req.query();
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (String name : p.names()) {
      out.put(name, new ArrayList<>(p.all(name)));
    }
    return out;
  }

  public static String param(ServerRequest req, String name) {
    return req.path().pathParameters().first(name).orElse("");
  }

  /** The request body as a value, or the 422 every target answers when it is not JSON. */
  @SuppressWarnings("unchecked")
  public static Map<String, Object> body(ServerRequest req) {
    try {
      return req.content().as(Map.class);
    } catch (RuntimeException e) {
      throw new Errors.Malformed(e.getMessage());
    }
  }

  /** A 204 or a 304 carries no body, so it declares no type. */
  public static void noBody(ServerResponse res, int status) {
    res.status(status).send();
  }
}

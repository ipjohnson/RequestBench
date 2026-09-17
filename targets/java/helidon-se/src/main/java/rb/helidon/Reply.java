package rb.helidon;

import io.helidon.webserver.http.ServerRequest;
import io.helidon.webserver.http.ServerResponse;
import java.util.Map;
import rb.domain.Errors;

/** What more than one family needs from a Helidon request. */
public final class Reply {
  private Reply() {}

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

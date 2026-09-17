package rb.javalin;

import io.javalin.http.Context;
import java.util.Map;
import rb.domain.Errors;

/** What more than one family needs from a Javalin Context. */
public final class Support {
  private Support() {}

  /** The request body as a value, or the 422 every target answers when it is not JSON. */
  @SuppressWarnings("unchecked")
  // rb:wiring body.*,domain.*
  public static Map<String, Object> body(Context ctx) {
    try {
      return ctx.bodyAsClass(Map.class);
    } catch (RuntimeException e) {
      throw new Errors.Malformed(e.getMessage());
    }
  }

  /**
   * A 204 or a 304 carries no body, so it declares no type. Javalin's defaultContentType is
   * text/plain and it is applied whether or not a result was set, which describes a body
   * that is not there.
   */
  public static void noBody(Context ctx, int status) {
    ctx.status(status);
    ctx.res().setContentType(null);
  }
}

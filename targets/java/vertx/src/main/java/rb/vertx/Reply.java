package rb.vertx;

import io.vertx.core.buffer.Buffer;
import io.vertx.ext.web.RoutingContext;
import java.util.LinkedHashMap;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;

/** What more than one family needs from a RoutingContext. */
public final class Reply {
  private Reply() {}

  // rb:wiring domain.*,parameters.*,json.*,headers.*,authorized.*,middleware.*
  public static void json(RoutingContext ctx, int status, Object value) {
    byte[] raw = Json.bytes(value);
    ctx.response()
       .setStatusCode(status)
       .putHeader("content-type", "application/json")
       .putHeader("content-length", Integer.toString(raw.length))
       .end(Buffer.buffer(raw));
  }

  /** A 204 or a 304 carries no body, so it declares neither a type nor a length. */
  public static void noBody(RoutingContext ctx, int status) {
    ctx.response().setStatusCode(status).end();
  }

  /**
   * The route-level failure handler. A ValidationHandler does not throw into the handler
   * chain: it fails the routing context, and without this Vert.x answers its own plain-text
   * "Bad Request" before any of this target's rendering runs.
   */
  public static void failure(RoutingContext ctx) {
    Throwable t = ctx.failure();
    if (t == null) {
      json(ctx, ctx.statusCode() < 0 ? 500 : ctx.statusCode(),
           java.util.Map.of("error", "internal", "message", "no failure recorded"));
      return;
    }
    fail(ctx, t);
  }

  /**
   * Maps the domain's failures onto statuses. Handlers raise and never build a 404 or a 422
   * themselves, so the six Java targets cannot drift.
   */
  // rb:wiring errors.*
  public static void fail(RoutingContext ctx, Throwable t) {
    if (t instanceof Errors.NotFound) {
      json(ctx, 404, Domain.notFoundBody());
    } else if (Validation.isRefusal(t)) {
      // The ValidationHandler refused the body. Vert.x's own status for that is 400.
      json(ctx, 400, Validation.refusedBody(t).getMap());
    } else if (t instanceof Errors.Malformed m) {
      // Nothing validated it, so it names no field.
      json(ctx, 400, java.util.Map.of("error", "invalid_body",
          "detail", m.getMessage() == null ? "unreadable" : m.getMessage()));
    } else {
      Map<String, Object> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", t.getMessage() == null ? "internal" : t.getMessage());
      json(ctx, 500, b);
    }
  }

  /** Runs a handler and turns anything it raises into the shared failure shape. */
  public static void guarded(RoutingContext ctx, Runnable work) {
    try {
      work.run();
    } catch (RuntimeException e) {
      fail(ctx, e);
    }
  }

  /** The request body as a value, or the 422 every target answers when it is not JSON. */
  // rb:wiring body.*,domain.*
  public static Map<String, Object> body(RoutingContext ctx) {
    return Json.body(ctx.body().asString());
  }
}

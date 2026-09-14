package rb.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import java.util.Map;
import rb.baseline.Result;
import rb.baseline.Router;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;
import rb.hosts.Event;
import rb.hosts.Hosts;

/**
 * Host: lambda-rie, for the bare baseline.
 *
 * Every target's Lambda entry is rb.lambda.Handler, so one CMD in Dockerfile.lambda covers
 * them all the way one ENTRYPOINT covers the container host. A build arg cannot reach an
 * exec-form CMD, and a per-target CMD would be a second place to keep the target list.
 *
 * The event goes straight into the same Router the container host uses. There is no HTTP
 * server anywhere in this path and no adapter in front of it, which is what makes this the
 * floor for the host rather than a translation of another host's floor.
 */
public class Handler
    implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

  public Handler() {
    // Lambda constructs the handler once, during init. Loading here rather than per
    // invocation keeps the fixture read out of the measured path.
    try {
      Domain.load(Hosts.fixture());
    } catch (Exception e) {
      throw new IllegalStateException("fixture", e);
    }
    Hosts.adapter("aws-lambda-java-core", "aws-lambda-core");
  }

  @Override
  public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context ctx) {
    Result r;
    try {
      r = handle(event);
    } catch (Errors.Boom e) {
      r = Result.internal(e.getMessage());
    } catch (RuntimeException e) {
      r = Result.internal(e.getMessage() == null ? "internal" : e.getMessage());
    }
    return Event.response(r.status(), r.headers(), r.body());
  }

  private static Result handle(APIGatewayV2HTTPEvent event) {
    String method = Event.method(event);
    Map<String, Object> body = null;
    if (Router.hasBody(method)) {
      byte[] raw = Event.bodyBytes(event);
      if (raw != null) {
        try {
          body = Json.body(raw);
        } catch (Errors.Validation e) {
          return Result.validationFailed(e.errors());
        }
      }
    }
    return Router.route(method, Event.segments(Event.path(event)), Event.query(event), body);
  }
}

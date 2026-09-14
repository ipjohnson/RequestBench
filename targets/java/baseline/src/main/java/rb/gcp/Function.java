package rb.gcp;

import com.google.cloud.functions.HttpFunction;
import com.google.cloud.functions.HttpRequest;
import com.google.cloud.functions.HttpResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.Map;
import rb.baseline.Result;
import rb.baseline.Router;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;
import rb.hosts.Hosts;

/**
 * Host: gcp-func, for the bare baseline.
 *
 * The Functions Framework calls this directly, and it calls the same Router the container
 * host uses. There is no adapter in between, which is what makes it the floor for the host.
 *
 * Every target names its function rb.gcp.Function, so one command line in Dockerfile.gcp
 * covers them all.
 */
public class Function implements HttpFunction {

  public Function() {
    // The framework constructs the function once, before the first request.
    try {
      Domain.load(Hosts.fixture());
    } catch (Exception e) {
      throw new IllegalStateException("fixture", e);
    }
    Hosts.adapter("functions-framework-java", "gcp-functions");
  }

  @Override
  public void service(HttpRequest request, HttpResponse response) throws IOException {
    Result r;
    try {
      r = handle(request);
    } catch (Errors.Boom e) {
      r = Result.internal(e.getMessage());
    } catch (RuntimeException e) {
      r = Result.internal(e.getMessage() == null ? "internal" : e.getMessage());
    }
    write(response, r);
  }

  private static Result handle(HttpRequest request) throws IOException {
    String method = request.getMethod();
    Map<String, Object> body = null;
    if (Router.hasBody(method)) {
      byte[] raw = request.getInputStream().readAllBytes();
      if (raw.length > 0) {
        try {
          body = Json.body(raw);
        } catch (Errors.Validation e) {
          return Result.validationFailed(e.errors());
        }
      }
    }
    Map<String, List<String>> q = request.getQueryParameters();
    return Router.route(method, Router.split(request.getPath()), q, body);
  }

  private static void write(HttpResponse response, Result r) throws IOException {
    response.setStatusCode(r.status());
    for (Map.Entry<String, String> h : r.headers().entrySet()) {
      if (h.getKey().equals("content-type")) {
        response.setContentType(h.getValue());
      } else {
        response.appendHeader(h.getKey(), h.getValue());
      }
    }
    if (r.status() != 204) {
      response.appendHeader("content-length", String.valueOf(r.body().length));
      try (OutputStream out = response.getOutputStream()) {
        out.write(r.body());
      }
    }
  }
}

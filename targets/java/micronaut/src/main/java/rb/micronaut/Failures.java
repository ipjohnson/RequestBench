package rb.micronaut;

import io.micronaut.context.annotation.Replaces;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.codec.CodecException;
import io.micronaut.http.server.exceptions.ExceptionHandler;
import io.micronaut.json.JsonSyntaxException;
import jakarta.inject.Singleton;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;

/**
 * errors: every failure a handler raises, and the router's own miss.
 *
 * ExceptionHandler beans rather than @Error methods. @Error only covers what a controller
 * raises; a filter's failure never reaches one, which showed up as Micronaut's own 500 on
 * every filtered route.
 */
public final class Failures {
  private Failures() {}

  @Singleton
  public static class NotFoundHandler implements ExceptionHandler<Errors.NotFound, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, Errors.NotFound e) {
      return HttpResponse.notFound(Domain.notFoundBody());
    }
  }

  @Singleton
  public static class InvalidHandler
      implements ExceptionHandler<Errors.Validation, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, Errors.Validation e) {
      return HttpResponse.status(HttpStatus.UNPROCESSABLE_ENTITY)
                         .body(Domain.invalidBody(e.errors()));
    }
  }

  /**
   * Micronaut raises this when it cannot read the request body as JSON, which is what
   * errors.malformed asks for. The endpoint set answers 422 there, the same status as a
   * body that parsed and failed validation, and @Replaces is what puts this ahead of
   * Micronaut's own handler, which answers 400 with its own shape.
   */
  @Singleton
  @Replaces(io.micronaut.http.server.exceptions.JsonExceptionHandler.class)
  public static class MalformedHandler
      implements ExceptionHandler<JsonSyntaxException, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, JsonSyntaxException e) {
      return HttpResponse.status(HttpStatus.UNPROCESSABLE_ENTITY)
                         .body(Domain.invalidBody(Errors.Validation.json().errors()));
    }
  }

  /** The same 422 for the Jackson-level failure, which arrives as a CodecException. */
  @Singleton
  @Replaces(io.micronaut.http.server.exceptions.JacksonExceptionHandler.class)
  public static class CodecHandler implements ExceptionHandler<CodecException, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, CodecException e) {
      return HttpResponse.status(HttpStatus.UNPROCESSABLE_ENTITY)
                         .body(Domain.invalidBody(Errors.Validation.json().errors()));
    }
  }

  @Singleton
  public static class InternalHandler implements ExceptionHandler<Throwable, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, Throwable e) {
      return HttpResponse.serverError(
          Map.of("error", "internal",
                 "message", e.getMessage() == null ? "internal" : e.getMessage()));
    }
  }
}

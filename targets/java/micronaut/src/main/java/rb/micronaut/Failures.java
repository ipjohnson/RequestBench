package rb.micronaut;

import io.micronaut.context.annotation.Replaces;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.server.exceptions.ExceptionHandler;
import jakarta.inject.Singleton;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
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
  // rb:wiring errors.*
  public static class NotFoundHandler implements ExceptionHandler<Errors.NotFound, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, Errors.NotFound e) {
      return HttpResponse.notFound(Domain.notFoundBody());
    }
  }

  /**
   * The generated validator's own failure, raised by Micronaut before the controller method
   * is entered. The envelope is the violations as it reported them: the property path it
   * walked and its own message, which is its vocabulary and not this repository's.
   *
   * @Replaces puts this ahead of Micronaut's own handler, which answers its own shape.
   */
  @Singleton
  @Replaces(io.micronaut.validation.exceptions.ConstraintExceptionHandler.class)
  // rb:wiring errors.*,body.*
  public static class InvalidHandler
      implements ExceptionHandler<ConstraintViolationException, HttpResponse<?>> {
    @Override
    public HttpResponse<?> handle(HttpRequest request, ConstraintViolationException e) {
      List<Map<String, String>> errors = e.getConstraintViolations().stream()
          .map(v -> Map.of("field", v.getPropertyPath().toString(),
                           "message", v.getMessage()))
          .toList();
      return HttpResponse.status(HttpStatus.BAD_REQUEST)
                         .body(Map.of("error", "validation_failed", "errors", errors));
    }
  }

  // There is deliberately no handler for a body Micronaut could not read. It answers that
  // itself, and its own envelope is a message and nothing else; replacing it would put this
  // repository's shape where the framework's belongs. A validation failure is different --
  // Micronaut's default for that is a HAL-shaped body, and every target here renders the
  // failures as a list, so that one is rendered above.

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

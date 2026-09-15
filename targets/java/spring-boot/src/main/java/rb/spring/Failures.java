package rb.spring;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import rb.domain.Domain;
import rb.domain.Errors;

/**
 * errors: every failure a handler raises, and the router's own miss.
 *
 * Handlers raise and never build a 404 or a 422 themselves, so the six Java targets cannot
 * drift.
 */
@RestControllerAdvice
public class Failures {

  @ExceptionHandler(Errors.NotFound.class)
  ResponseEntity<Object> notFound(Errors.NotFound e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Domain.notFoundBody());
  }

  @ExceptionHandler(Errors.Validation.class)
  ResponseEntity<Object> invalid(Errors.Validation e) {
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                         .body(Domain.invalidBody(e.errors()));
  }

  /**
   * Spring raises this when Jackson cannot read the request body, which is what
   * errors.malformed asks for. The endpoint set answers 422 there, the same status as a
   * body that parsed and failed validation, so the two contracts meet here.
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Object> malformed(HttpMessageNotReadableException e) {
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                         .body(Domain.invalidBody(Errors.Validation.json().errors()));
  }

  /**
   * The router's own miss. Spring Boot answers an unmatched path with NoResourceFoundException
   * once the static-resource handler has also declined it, and NoHandlerFoundException when
   * there is no such handler; both are the same 404 here.
   */
  // rb:snippet errors.unmatched
  @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
  ResponseEntity<Object> unmatched(Exception e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Domain.notFoundBody());
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Object> internal(Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "internal",
                     "message", e.getMessage() == null ? "internal" : e.getMessage()));
  }
}

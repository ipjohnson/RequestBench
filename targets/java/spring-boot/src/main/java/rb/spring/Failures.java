package rb.spring;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
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

  /**
   * Spring raises this itself when a parameter marked @Valid fails a constraint, before the
   * controller method is entered. The envelope is Spring's own: the field as the binding
   * names it and the message Hibernate Validator produced, which is its vocabulary and not
   * this repository's.
   */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Object> invalid(MethodArgumentNotValidException e) {
    List<Map<String, String>> errors = e.getBindingResult().getFieldErrors().stream()
        .map(f -> Map.of("field", f.getField(),
                         "message", f.getDefaultMessage() == null ? "" : f.getDefaultMessage()))
        .toList();
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("error", "validation_failed", "errors", errors));
  }

  /**
   * Spring raises this when Jackson cannot read the request body at all. Nothing validated
   * it, so it names no field, and Spring's own status for an unreadable body is 400.
   */
  @ExceptionHandler({HttpMessageNotReadableException.class, Errors.Malformed.class})
  ResponseEntity<Object> malformed(Exception e) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("error", "invalid_body",
                     "detail", e.getMessage() == null ? "unreadable" : e.getMessage()));
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

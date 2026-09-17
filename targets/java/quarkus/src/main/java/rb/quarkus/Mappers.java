package rb.quarkus;

import jakarta.ws.rs.core.Response;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;

/** Domain outcomes to the statuses and bodies every other target produces. */
public final class Mappers {

  @Provider
  // rb:wiring errors.*
  public static class NotFound implements ExceptionMapper<Errors.NotFound> {
    @Override
    public Response toResponse(Errors.NotFound e) {
      return Response.status(404).entity(Domain.notFoundBody()).build();
    }
  }

  /**
   * Hibernate Validator's own failure, raised by Quarkus before the resource method is
   * entered. The envelope is the violations as it reported them: the property path it
   * walked and its own message, which is its vocabulary and not this repository's.
   */
  @Provider
  // rb:wiring errors.*,body.*
  public static class Invalid implements ExceptionMapper<ConstraintViolationException> {
    @Override
    public Response toResponse(ConstraintViolationException e) {
      List<Map<String, String>> errors = e.getConstraintViolations().stream()
          .map(v -> Map.of("field", v.getPropertyPath().toString(),
                           "message", v.getMessage()))
          .toList();
      Map<String, Object> body = new LinkedHashMap<>(2);
      body.put("error", "validation_failed");
      body.put("errors", errors);
      return Response.status(400).entity(body).build();
    }
  }

  /** A body Jackson could not read. Nothing validated it, so it names no field. */
  @Provider
  // rb:wiring errors.*
  public static class NotBound implements ExceptionMapper<Errors.Malformed> {
    @Override
    public Response toResponse(Errors.Malformed e) {
      return Response.status(400).entity(notBound(e.getMessage())).build();
    }
  }

  static Map<String, Object> notBound(String detail) {
    Map<String, Object> body = new LinkedHashMap<>(2);
    body.put("error", "invalid_body");
    body.put("detail", detail == null ? "unreadable" : detail);
    return body;
  }

  /**
   * Unmatched paths. Quarkus answers them with jakarta.ws.rs.NotFoundException, whose
   * default body is not the one the contract asks for. Registered separately from the
   * domain's own NotFound so a routing miss and a lookup miss stay distinguishable here
   * even though they produce the same body.
   */
  @Provider
  // rb:handler errors.unmatched
  public static class Unmatched implements ExceptionMapper<jakarta.ws.rs.NotFoundException> {
    @Override
    public Response toResponse(jakarta.ws.rs.NotFoundException e) {
      return Response.status(404).entity(Domain.notFoundBody()).build();
    }
  }

  @Provider
  public static class Internal implements ExceptionMapper<Throwable> {
    @Override
    public Response toResponse(Throwable e) {
      Map<String, String> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", e.getMessage() == null ? "internal" : e.getMessage());
      return Response.status(500).entity(b).build();
    }
  }

  private Mappers() {}

  /**
   * A body Quarkus could not read. It arrives wrapped in a JAX-RS BadRequestException
   * rather than as the Jackson error underneath, which is why the mapper is on that type.
   * errors.malformed answers 422 there, the same status as a body that parsed and failed
   * validation, so the two contracts meet here.
   */
  @Provider
  public static class Malformed
      implements ExceptionMapper<jakarta.ws.rs.WebApplicationException> {
    @Override
    public Response toResponse(jakarta.ws.rs.WebApplicationException e) {
      int status = e.getResponse() == null ? 500 : e.getResponse().getStatus();
      if (status == 400) {
        return Response.status(400).entity(notBound(e.getMessage())).build();
      }
      if (status == 404) {
        return Response.status(404).entity(Domain.notFoundBody()).build();
      }
      Map<String, Object> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", e.getMessage() == null ? "internal" : e.getMessage());
      return Response.status(status).entity(b).build();
    }
  }
}

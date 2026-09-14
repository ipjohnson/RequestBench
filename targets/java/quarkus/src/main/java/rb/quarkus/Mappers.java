package rb.quarkus;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.LinkedHashMap;
import java.util.Map;
import rb.domain.Errors;

/** Domain outcomes to the statuses and bodies every other target produces. */
public final class Mappers {

  @Provider
  public static class NotFound implements ExceptionMapper<Errors.NotFound> {
    @Override
    public Response toResponse(Errors.NotFound e) {
      return Response.status(404).entity(Map.of("error", "not_found")).build();
    }
  }

  @Provider
  public static class Validation implements ExceptionMapper<Errors.Validation> {
    @Override
    public Response toResponse(Errors.Validation e) {
      Map<String, Object> b = new LinkedHashMap<>(2);
      b.put("error", "validation_failed");
      b.put("errors", e.errors());
      return Response.status(422).entity(b).build();
    }
  }

  /**
   * Unmatched paths. Quarkus answers them with jakarta.ws.rs.NotFoundException, whose
   * default body is not the one the contract asks for. Registered separately from the
   * domain's own NotFound so a routing miss and a lookup miss stay distinguishable here
   * even though they produce the same body.
   */
  @Provider
  public static class Unmatched implements ExceptionMapper<jakarta.ws.rs.NotFoundException> {
    @Override
    public Response toResponse(jakarta.ws.rs.NotFoundException e) {
      return Response.status(404).entity(Map.of("error", "not_found")).build();
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
}

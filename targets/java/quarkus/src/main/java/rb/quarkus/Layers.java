package rb.quarkus;

import jakarta.ws.rs.NameBinding;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The name bindings that scope a JAX-RS filter to a method.
 *
 * A ContainerRequestFilter without one runs on every endpoint, which would put the
 * authorized family's check and the middleware family's layers on all forty-five and
 * contaminate the rows they are measured against.
 */
public final class Layers {
  private Layers() {}

  @NameBinding
  @Retention(RetentionPolicy.RUNTIME)
  @Target({ElementType.TYPE, ElementType.METHOD})
  public @interface Four {}

  @NameBinding
  @Retention(RetentionPolicy.RUNTIME)
  @Target({ElementType.TYPE, ElementType.METHOD})
  public @interface Sixteen {}

  @NameBinding
  @Retention(RetentionPolicy.RUNTIME)
  @Target({ElementType.TYPE, ElementType.METHOD})
  public @interface Authorized {}
}

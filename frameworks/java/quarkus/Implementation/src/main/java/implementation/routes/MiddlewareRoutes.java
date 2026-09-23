package implementation.routes;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import implementation.Payload;
import implementation.Payloads;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NameBinding;
import jakarta.ws.rs.Path;

/**
 * middleware: no-op request filters in front of the handler, four or sixteen of them, declared in
 * MiddlewareLayers. Each filter carries one of the name bindings below, and runs only on a method
 * that carries the same one.
 */
@Path("/middleware")
public class MiddlewareRoutes {

    // rb:wiring middleware.*
    @NameBinding
    @Retention(RetentionPolicy.RUNTIME)
    @Target({ElementType.TYPE, ElementType.METHOD})
    public @interface Four {}

    @NameBinding
    @Retention(RetentionPolicy.RUNTIME)
    @Target({ElementType.TYPE, ElementType.METHOD})
    public @interface Sixteen {}
    // rb:end

    private final Payloads p;

    MiddlewareRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler middleware.none
    @GET
    @Path("none")
    public Payload none() {
        return p.small();
    }

    // rb:handler middleware.four
    @GET
    @Path("four")
    @Four
    public Payload four() {
        return p.small();
    }

    // rb:handler middleware.sixteen
    @GET
    @Path("sixteen")
    @Sixteen
    public Payload sixteen() {
        return p.small();
    }
}

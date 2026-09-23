package implementation.routes;

import implementation.FirstErrorOrder;
import implementation.OrderRequest;
import jakarta.validation.Valid;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.HttpHeaders;

/**
 * body: the order read by Jackson and bound to a record on every route, and validated by Hibernate
 * Validator where the parameter is marked @Valid. Quarkus refuses a body that breaks a rule with
 * its violation report, and one Jackson cannot read with a 400 of its own, both before the handler
 * runs.
 */
@Path("/body")
public class BodyRoutes {

    /**
     * What a bind or validate row answers: the order back, with the leaves the handler found in it
     * and the bytes it received.
     */
    public record Bound<T>(int fields, long bytes, T echo) {

        /** customerId and status, and a productId and a qty per line. */
        static <T> Bound<T> of(T order, int lines, HttpHeaders headers) {
            return new Bound<>(2 + 2 * lines, headers.getLength(), order);
        }
    }

    // rb:handler body.bind_small
    @POST
    @Path("bind/small")
    public Bound<OrderRequest> bindSmall(OrderRequest order, HttpHeaders headers) {
        return Bound.of(order, order.lines().size(), headers);
    }

    // rb:handler body.bind_medium
    @POST
    @Path("bind/medium")
    public Bound<OrderRequest> bindMedium(OrderRequest order, HttpHeaders headers) {
        return Bound.of(order, order.lines().size(), headers);
    }

    // rb:handler body.validate_small,body.rejected_all,errors.malformed
    @POST
    @Path("validate/small")
    public Bound<OrderRequest> validateSmall(@Valid OrderRequest order, HttpHeaders headers) {
        return Bound.of(order, order.lines().size(), headers);
    }

    // rb:handler body.validate_medium
    @POST
    @Path("validate/medium")
    public Bound<OrderRequest> validateMedium(@Valid OrderRequest order, HttpHeaders headers) {
        return Bound.of(order, order.lines().size(), headers);
    }

    // rb:handler body.rejected_first
    @POST
    @Path("validate/first-error")
    public Bound<FirstErrorOrder> validateFirstError(@Valid FirstErrorOrder order, HttpHeaders headers) {
        return Bound.of(order, order.lines().size(), headers);
    }
}

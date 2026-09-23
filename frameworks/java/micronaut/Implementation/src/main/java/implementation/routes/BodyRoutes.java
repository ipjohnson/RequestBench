package implementation.routes;

import implementation.FirstErrorOrder;
import implementation.OrderRequest;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Post;
import io.micronaut.serde.annotation.Serdeable;
import jakarta.validation.Valid;

/**
 * body: the order read by Micronaut Serialization and bound to a record on every route, and
 * validated by micronaut-validation where the parameter is marked @Valid. The validator runs
 * before the handler and raises ConstraintViolationException for a body that breaks a rule, which
 * Micronaut answers with 400. A body the parser cannot read is refused with 400 before any of it
 * is bound.
 */
@Controller
public class BodyRoutes {

    /**
     * What a bind or validate row answers: the order back, with the leaves the handler found in it
     * and the bytes it received.
     */
    @Serdeable
    public record Bound<T>(int fields, long bytes, T echo) {

        /** customerId and status, and a productId and a qty per line. */
        static <T> Bound<T> of(T order, int lines, HttpRequest<?> request) {
            return new Bound<>(2 + 2 * lines, request.getContentLength(), order);
        }
    }

    @Post("/body/bind/small")
    public Bound<OrderRequest> bindSmall(@Body OrderRequest order, HttpRequest<?> request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @Post("/body/bind/medium")
    public Bound<OrderRequest> bindMedium(@Body OrderRequest order, HttpRequest<?> request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @Post("/body/validate/small")
    public Bound<OrderRequest> validateSmall(@Valid @Body OrderRequest order, HttpRequest<?> request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @Post("/body/validate/medium")
    public Bound<OrderRequest> validateMedium(@Valid @Body OrderRequest order, HttpRequest<?> request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @Post("/body/validate/first-error")
    public Bound<FirstErrorOrder> validateFirstError(@Valid @Body FirstErrorOrder order, HttpRequest<?> request) {
        return Bound.of(order, order.lines().size(), request);
    }
}

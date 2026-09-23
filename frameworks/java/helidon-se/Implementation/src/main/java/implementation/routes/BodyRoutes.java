package implementation.routes;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;

import implementation.OrderRequest;
import io.helidon.http.Status;
import io.helidon.json.binding.Json;
import io.helidon.service.registry.Services;
import io.helidon.validation.TypeValidation;
import io.helidon.validation.ValidationException;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;

/**
 * body: the order read by Helidon JSON Binding and bound to a record on every route, and checked by
 * Helidon Validation where the handler asks TypeValidation to. A body the binding cannot read is
 * refused by the media support with its own 400 before the handler sees it.
 */
public final class BodyRoutes implements HttpFeature {

    /**
     * What a bind or validate row answers: the order back, with the leaves the handler found in it
     * and the bytes it received.
     */
    @Json.Entity
    public record Bound(int fields, long bytes, OrderRequest echo) {

        /** customerId and status, and a productId and a qty per line. */
        static Bound of(OrderRequest order, ServerRequest request) {
            return new Bound(2 + 2 * order.lines().size(), request.headers().contentLength().orElse(-1), order);
        }
    }

    /** The body a refused order is answered with. */
    @Json.Entity
    public record Refused(String error) {}

    // rb:wiring body.*
    /** The order's components as the record declares them, which the first-error route checks in turn. */
    private static final List<String> DECLARED = Arrays.stream(OrderRequest.class.getRecordComponents()).map(RecordComponent::getName).toList();

    private final TypeValidation validation = Services.get(TypeValidation.class);
    // rb:end

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.post("/body/bind/small", (req, res) -> res.send(Bound.of(req.content().as(OrderRequest.class), req)));

        routing.post("/body/bind/medium", (req, res) -> res.send(Bound.of(req.content().as(OrderRequest.class), req)));

        routing.post("/body/validate/small", (req, res) -> {
            OrderRequest order = req.content().as(OrderRequest.class);
            validation.check(OrderRequest.class, order);
            res.send(Bound.of(order, req));
        });

        routing.post("/body/validate/medium", (req, res) -> {
            OrderRequest order = req.content().as(OrderRequest.class);
            validation.check(OrderRequest.class, order);
            res.send(Bound.of(order, req));
        });

        // Helidon Validation reports every rule an object breaks. This route asks it about one
        // component at a time and stops at the first that fails.
        routing.post("/body/validate/first-error", (req, res) -> {
            OrderRequest order = req.content().as(OrderRequest.class);
            for (String component : DECLARED) {
                validation.check(OrderRequest.class, order, component);
            }
            res.send(Bound.of(order, req));
        });

        // rb:wiring body.*
        // helidon-webserver-validation, Helidon's own mapping of a ValidationException, answers 400
        // with no body, so the refusal names no field. This answers it as Helidon's SE quickstart
        // answers a body it refuses: 400 and the message under error.
        routing.error(ValidationException.class, (req, res, e) -> res.status(Status.BAD_REQUEST_400).send(new Refused(e.getMessage())));
    }
}

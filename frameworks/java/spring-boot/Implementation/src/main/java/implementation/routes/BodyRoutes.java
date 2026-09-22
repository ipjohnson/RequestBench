package implementation.routes;

import implementation.FirstErrorOrder;
import implementation.OrderRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * body: the order read by Jackson and bound to a record on every route, and validated by Bean
 * Validation where the parameter is marked @Valid. Spring MVC refuses a body that breaks a rule
 * with MethodArgumentNotValidException, and one Jackson cannot read with
 * HttpMessageNotReadableException, both before the handler runs, and Boot's error page answers
 * each with 400.
 */
@RestController
public class BodyRoutes {

    /**
     * What a bind or validate row answers: the order back, with the leaves the handler found in it
     * and the bytes it received.
     */
    public record Bound<T>(int fields, long bytes, T echo) {

        /** customerId and status, and a productId and a qty per line. */
        static <T> Bound<T> of(T order, int lines, HttpServletRequest request) {
            return new Bound<>(2 + 2 * lines, request.getContentLengthLong(), order);
        }
    }

    @PostMapping("/body/bind/small")
    public Bound<OrderRequest> bindSmall(@RequestBody OrderRequest order, HttpServletRequest request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @PostMapping("/body/bind/medium")
    public Bound<OrderRequest> bindMedium(@RequestBody OrderRequest order, HttpServletRequest request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @PostMapping("/body/validate/small")
    public Bound<OrderRequest> validateSmall(@Valid @RequestBody OrderRequest order, HttpServletRequest request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @PostMapping("/body/validate/medium")
    public Bound<OrderRequest> validateMedium(@Valid @RequestBody OrderRequest order, HttpServletRequest request) {
        return Bound.of(order, order.lines().size(), request);
    }

    @PostMapping("/body/validate/first-error")
    public Bound<FirstErrorOrder> validateFirstError(@Valid @RequestBody FirstErrorOrder order, HttpServletRequest request) {
        return Bound.of(order, order.lines().size(), request);
    }
}

package implementation;

// rb:wiring body.*
import java.util.List;
import java.util.function.Predicate;

import io.javalin.http.Context;
import io.javalin.validation.BodyValidator;
import io.javalin.validation.Validation;

/**
 * The body the bind and validate rows send, and the rules orderRequest states as checks for
 * Javalin's validator, each filed under the field it is about. The bind routes read the same record
 * with ctx.bodyAsClass and check nothing.
 */
public record OrderRequest(int customerId, String status, List<Line> lines) {

    public record Line(int productId, int qty) {}

    private record Rule(String field, Predicate<OrderRequest> holds, String error) {}

    private static final List<Rule> RULES = List.of(
            new Rule("customerId", order -> order.customerId() > 0, "must be greater than 0"),
            new Rule("status", order -> order.status() != null && !order.status().isEmpty(), "must not be empty"),
            new Rule("lines", order -> order.lines() != null && !order.lines().isEmpty(), "must not be empty"),
            new Rule("lines", order -> order.lines() == null || order.lines().stream().allMatch(OrderRequest::valid),
                    "every line needs a productId and a qty greater than 0"));

    private static boolean valid(Line line) {
        return line != null && line.productId() > 0 && line.qty() > 0;
    }

    /**
     * The body read through ctx.bodyValidator with every rule as a check. Javalin runs all of them
     * and throws ValidationException naming each field that failed, which it answers with 400.
     */
    public static OrderRequest validated(Context ctx) {
        BodyValidator<OrderRequest> body = ctx.bodyValidator(OrderRequest.class);
        for (Rule rule : RULES) {
            body.check(rule.field(), rule.holds()::test, rule.error());
        }
        return body.get();
    }

    /**
     * The same rules one at a time, in the order orderRequest states them. Javalin's validator runs
     * every check it holds and has no mode that stops at the first, so each rule gets a validator of
     * its own, and the first that fails throws the same ValidationException, naming one field.
     */
    public static OrderRequest firstError(Context ctx) {
        OrderRequest order = ctx.bodyValidator(OrderRequest.class).get();
        Validation validation = ctx.appData(Validation.ValidationKey);
        for (Rule rule : RULES) {
            validation.validator(rule.field(), order).check(rule.holds()::test, rule.error()).get();
        }
        return order;
    }
}
// rb:end

package rb.javalin;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import rb.domain.Domain;
import rb.domain.Model.LineInput;
import rb.domain.Model.ValidatedOrder;

/**
 * The order body, and the checks Javalin's own validator runs over it.
 *
 * Javalin has no Bean Validation: it has ctx.bodyValidator, which deserializes into a class
 * and then runs whatever check() calls are chained onto it, collecting the failures and
 * raising ValidationException itself. The checks are declared here so the route reads as one
 * call and the rules live in one place, but Javalin is what runs them and what decides the
 * answer.
 *
 * The boxed types are what makes a missing field distinguishable from a zero one.
 */
// rb:wiring body.*,domain.*
public record OrderIn(@JsonProperty("customer_id") Integer customerId,
                      String status,
                      List<LineIn> lines) {

  public record LineIn(@JsonProperty("product_id") Integer productId, Integer qty) {}

  /** The order, once Javalin's validator has said the body is one. */
  // rb:wiring body.*,domain.*
  public ValidatedOrder order() {
    return Domain.priceOrder(customerId, status,
        lines.stream().map(l -> new LineInput(l.productId(), l.qty())).toList());
  }

  public boolean hasCustomerId() {
    return customerId != null;
  }

  public boolean hasStatus() {
    return status != null;
  }

  public boolean hasLines() {
    return lines != null && !lines.isEmpty();
  }

  public boolean linesAreComplete() {
    return lines != null
        && lines.stream().allMatch(l -> l.productId() != null && l.qty() != null && l.qty() >= 1);
  }
}

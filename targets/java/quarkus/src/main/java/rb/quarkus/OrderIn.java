package rb.quarkus;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import rb.domain.Domain;
import rb.domain.Model.LineInput;
import rb.domain.Model.ValidatedOrder;

/**
 * The order body, as Jakarta Bean Validation declares one.
 *
 * The annotations are the wiring. Quarkus runs Hibernate Validator on a resource method
 * parameter marked {@code @Valid} before the method is entered, so no handler calls a
 * validator, and it raises ConstraintViolationException itself when a constraint fails.
 *
 * The boxed types are what makes {@code @NotNull} mean present: an int is indistinguishable
 * from an absent one, because both arrive as zero.
 */
public record OrderIn(@JsonProperty("customer_id") @NotNull Integer customerId,
                      @NotNull String status,
                      @NotNull @Size(min = 1) List<@Valid LineIn> lines) {

  public record LineIn(@JsonProperty("product_id") @NotNull Integer productId,
                       @NotNull @Min(1) Integer qty) {}

  /** The order, once Bean Validation has said the body is one. */
  public ValidatedOrder order() {
    return Domain.priceOrder(customerId, status,
        lines.stream().map(l -> new LineInput(l.productId(), l.qty())).toList());
  }
}

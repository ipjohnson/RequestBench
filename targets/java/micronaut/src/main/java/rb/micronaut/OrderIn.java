package rb.micronaut;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.micronaut.core.annotation.Introspected;
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
 * The annotations are the wiring. micronaut-validation reads them at compile time -- the
 * annotation processor generates the validator rather than reflecting at startup, which is
 * the whole point of Micronaut -- and Micronaut runs it on a parameter marked {@code @Valid}
 * before the controller method is entered.
 *
 * {@code @Introspected} is what gives the processor something to generate from: without it
 * there is no bean introspection for the record and nothing to validate.
 *
 * The boxed types are what makes {@code @NotNull} mean present: an int is indistinguishable
 * from an absent one, because both arrive as zero.
 */
@Introspected
// rb:wiring body.*,domain.*
public record OrderIn(@JsonProperty("customer_id") @NotNull Integer customerId,
                      @NotNull String status,
                      @NotNull @Size(min = 1) List<@Valid LineIn> lines) {

  @Introspected
  public record LineIn(@JsonProperty("product_id") @NotNull Integer productId,
                       @NotNull @Min(1) Integer qty) {}

  /** The order, once Bean Validation has said the body is one. */
  // rb:wiring body.*,domain.*
  public ValidatedOrder order() {
    return Domain.priceOrder(customerId, status,
        lines.stream().map(l -> new LineInput(l.productId(), l.qty())).toList());
  }
}

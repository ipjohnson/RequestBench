package implementation;

// rb:wiring body.*
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

/**
 * The body the bind and validate rows send, with the rules orderRequest states as Bean Validation
 * constraints. They run only where a handler marks the parameter @Valid, so the bind routes bind
 * the same record and check nothing.
 */
public record OrderRequest(@Positive int customerId, @NotEmpty String status, @NotEmpty List<@Valid Line> lines) {

    public record Line(@Positive int productId, @Positive int qty) {}
}
// rb:end

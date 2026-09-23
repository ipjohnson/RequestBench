package implementation;

// rb:wiring body.*
import java.util.List;

import io.helidon.json.binding.Json;
import io.helidon.validation.Validation;

/**
 * The body the bind and validate rows send, with the rules orderRequest states as Helidon
 * Validation constraints. Helidon's annotation processor writes a validator for each
 * @Validation.Validated record, and it runs only where a handler asks TypeValidation for it, so
 * the bind routes bind the same record and check nothing.
 */
@Json.Entity
@Validation.Validated
public record OrderRequest(@Validation.Number.Positive int customerId,
                           @Validation.String.NotEmpty String status,
                           @Validation.Collection.Size(min = 1) List<@Validation.Valid Line> lines) {

    @Json.Entity
    @Validation.Validated
    public record Line(@Validation.Number.Positive int productId, @Validation.Number.Positive int qty) {}
}
// rb:end

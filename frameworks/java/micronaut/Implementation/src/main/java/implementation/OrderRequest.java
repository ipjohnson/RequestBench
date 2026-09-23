package implementation;

// rb:wiring body.*
import java.util.List;

import io.micronaut.serde.annotation.Serdeable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

/**
 * The body the bind and validate rows send, with the rules orderRequest states as Bean Validation
 * constraints. micronaut-validation's processor compiles them into the record's introspection,
 * and they run only where a handler marks the parameter @Valid, so the bind routes bind the same
 * record and check nothing.
 */
@Serdeable
public record OrderRequest(@Positive int customerId, @NotEmpty String status, @NotEmpty List<@Valid Line> lines) {

    @Serdeable
    public record Line(@Positive int productId, @Positive int qty) {}
}
// rb:end

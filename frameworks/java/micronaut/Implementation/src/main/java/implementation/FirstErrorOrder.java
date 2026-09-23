package implementation;

// rb:wiring body.*
import java.util.List;

import implementation.OrderRequest.Line;
import io.micronaut.serde.annotation.Serdeable;
import jakarta.validation.GroupSequence;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.groups.ConvertGroup;
import jakarta.validation.groups.Default;

/**
 * The same body on the route that stops at the first bad field. micronaut-validation reports
 * every constraint a bean breaks and has no mode that stops at the first. The group sequence
 * replaces this record's default group with one group per field, validated in order, and the
 * validator stops at the first group with a violation.
 */
@Serdeable
@GroupSequence({FirstErrorOrder.CustomerId.class, FirstErrorOrder.Status.class, FirstErrorOrder.Lines.class, FirstErrorOrder.class})
public record FirstErrorOrder(
        @Positive(groups = CustomerId.class) int customerId,
        @NotEmpty(groups = Status.class) String status,
        @NotEmpty(groups = Lines.class) List<@Valid @ConvertGroup(from = Lines.class, to = Default.class) Line> lines) {

    public interface CustomerId {}

    public interface Status {}

    public interface Lines {}
}
// rb:end

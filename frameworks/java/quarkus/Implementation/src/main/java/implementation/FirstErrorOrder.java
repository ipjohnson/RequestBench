package implementation;

// rb:wiring body.*
import java.util.List;

import implementation.OrderRequest.Line;
import jakarta.validation.GroupSequence;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.groups.ConvertGroup;
import jakarta.validation.groups.Default;

/**
 * The same body on the route that stops at the first bad field. The group sequence replaces this
 * record's default group with one group per field, validated in order, and Hibernate Validator
 * stops at the first group with a violation. Its fail-fast mode is one setting for the whole
 * application, and it stops at whichever constraint it reaches first.
 */
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

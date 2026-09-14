package rb.domain;

import java.util.List;
import rb.domain.Model.FieldError;

/**
 * The two control-flow signals every handler maps to a status, and the deliberate failure.
 *
 * NotFound and Validation fill in no stack trace. Both are ordinary outcomes here rather
 * than faults -- /orders/999999 and the malformed body are two of the forty measured
 * endpoints -- and capturing a stack on every one of them would put JVM stack walking
 * inside the number instead of framework overhead.
 */
public final class Errors {
  private Errors() {}

  public static final class NotFound extends RuntimeException {
    public static final NotFound INSTANCE = new NotFound();

    private NotFound() {
      super("not_found", null, false, false);
    }
  }

  public static final class Validation extends RuntimeException {
    private final List<FieldError> errors;

    public Validation(List<FieldError> errors) {
      super("validation failed", null, false, false);
      this.errors = errors;
    }

    public List<FieldError> errors() {
      return errors;
    }

    /** The body a malformed or rejected request gets, identical in every target. */
    public static Validation json() {
      return new Validation(List.of(new FieldError("body", "json")));
    }
  }

  /** The deliberate unhandled failure behind GET /boom. */
  public static final class Boom extends RuntimeException {
    public Boom() {
      super("deliberate unhandled failure");
    }
  }
}

package rb.domain;

/**
 * The two control-flow signals every handler maps to a status, and the deliberate failure.
 *
 * NotFound and Malformed fill in no stack trace. Both are ordinary outcomes here rather
 * than faults -- /orders/999999 and the malformed body are two of the forty-five measured
 * endpoints -- and capturing a stack on every one of them would put JVM stack walking
 * inside the number instead of framework overhead.
 *
 * There is no validation signal here. A body a framework's own validator refused is that
 * framework's answer, raised and rendered where the framework raises it.
 */
public final class Errors {
  private Errors() {}

  public static final class NotFound extends RuntimeException {
    public static final NotFound INSTANCE = new NotFound();

    private NotFound() {
      super("not_found", null, false, false);
    }
  }

  /**
   * A request body that is not JSON at all. Not a validation failure: nothing validated it,
   * so it names no field, and each target answers it in its own envelope.
   */
  public static final class Malformed extends RuntimeException {
    public Malformed(String detail) {
      super(detail, null, false, false);
    }
  }

  /** The deliberate unhandled failure behind GET /boom. */
  public static final class Boom extends RuntimeException {
    public Boom() {
      super("deliberate unhandled failure");
    }
  }
}

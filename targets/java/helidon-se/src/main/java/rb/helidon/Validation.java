package rb.helidon;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Model.LineInput;
import rb.domain.Model.ValidatedOrder;

/**
 * This target's own validation.
 *
 * Helidon SE has no validation layer to plug into -- it is a routing and server library, and
 * the MP flavour is where Bean Validation lives -- so the handler validates and this file is
 * where it lives. It is this target's copy on purpose: sharing one walk across six frameworks
 * measured the shared walk rather than the framework, which is the defect #35 describes.
 *
 * Because the walk reads the body as a value rather than binding it to a record, it sees
 * every field that is wrong instead of stopping where a binder would. That is what keeps
 * body.rejected_all and body.rejected_first different here, where spring-boot, quarkus and
 * micronaut collapse to one answer.
 */
public final class Validation {
  private Validation() {}

  /** One field this target's walk refused, and the rule it refused it under. */
  public record FieldError(String field, String rule) {}

  /** A body the walk refused, carrying every field it named. */
  public static final class Refused extends RuntimeException {
    private final List<FieldError> errors;

    public Refused(List<FieldError> errors) {
      super("validation failed", null, false, false);
      this.errors = errors;
    }

    public List<FieldError> errors() {
      return errors;
    }
  }

  public static Map<String, Object> refusedBody(List<FieldError> errors) {
    return Map.of("error", "validation_failed", "errors", errors);
  }

  public static Map<String, Object> notBoundBody(String detail) {
    return Map.of("error", "invalid_body", "detail", detail == null ? "unreadable" : detail);
  }

  private static boolean isInt(Object v) {
    return v instanceof Integer || v instanceof Long
        || (v instanceof Number n && n.doubleValue() == Math.rint(n.doubleValue()));
  }

  private static int intValue(Object v) {
    return ((Number) v).intValue();
  }

  private static Object lineField(Object line, String name) {
    return line instanceof Map<?, ?> m ? m.get(name) : null;
  }

  private static void required(List<FieldError> errs, Map<String, Object> body,
                               String field, String type) {
    Object v = body == null ? null : body.get(field);
    if (v == null) {
      errs.add(new FieldError(field, "required"));
      return;
    }
    switch (type) {
      case "int" -> {
        if (!isInt(v)) {
          errs.add(new FieldError(field, "int"));
        }
      }
      case "string" -> {
        if (!(v instanceof String)) {
          errs.add(new FieldError(field, "string"));
        }
      }
      case "array" -> {
        if (!(v instanceof List<?>)) {
          errs.add(new FieldError(field, "array"));
        }
      }
      default -> throw new IllegalArgumentException(type);
    }
  }

  /** Every field that is wrong, or the first one when asked for that. */
  public static List<FieldError> check(Map<String, Object> body, boolean firstError) {
    List<FieldError> errs = new ArrayList<>();
    required(errs, body, "customer_id", "int");
    if (!(firstError && !errs.isEmpty())) {
      required(errs, body, "status", "string");
    }
    if (!(firstError && !errs.isEmpty())) {
      required(errs, body, "lines", "array");
    }
    Object raw = body == null ? null : body.get("lines");
    List<?> rows = raw instanceof List<?> l ? l : null;
    if (rows != null && !(firstError && !errs.isEmpty())) {
      if (rows.isEmpty()) {
        errs.add(new FieldError("lines", "min_length"));
      }
      for (int i = 0; i < rows.size() && !(firstError && !errs.isEmpty()); i++) {
        Object pid = lineField(rows.get(i), "product_id");
        Object qty = lineField(rows.get(i), "qty");
        if (!isInt(pid)) {
          errs.add(new FieldError("lines[" + i + "].product_id", "int"));
        }
        if (!(firstError && !errs.isEmpty()) && (!isInt(qty) || intValue(qty) < 1)) {
          errs.add(new FieldError("lines[" + i + "].qty", "min"));
        }
      }
    }
    return errs;
  }

  /** The order, or Refused naming every field the walk would not accept. */
  public static ValidatedOrder validated(Map<String, Object> body, boolean firstError) {
    List<FieldError> errs = check(body, firstError);
    if (!errs.isEmpty()) {
      throw new Refused(errs);
    }
    List<?> rows = (List<?>) body.get("lines");
    List<LineInput> in = new ArrayList<>(rows.size());
    for (Object row : rows) {
      in.add(new LineInput(intValue(lineField(row, "product_id")),
                           intValue(lineField(row, "qty"))));
    }
    return Domain.priceOrder(intValue(body.get("customer_id")), (String) body.get("status"), in);
  }
}

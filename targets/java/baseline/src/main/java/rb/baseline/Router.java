package rb.baseline;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors.Boom;
import rb.domain.Errors.NotFound;
import rb.domain.Errors.Validation;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/**
 * Dispatch on method and path segments, with no framework and no router library.
 *
 * A port of the switch in targets/go/baseline/routes.go. Throws Boom on /boom, which every
 * transport recovers into the same 500 the contract asks for.
 */
public final class Router {
  private Router() {}

  public static Result route(String method, String[] seg, Map<String, List<String>> q,
                             JsonNode body) {
    try {
      return dispatch(method, seg, q, body);
    } catch (NotFound e) {
      return Result.NOT_FOUND;
    } catch (Validation e) {
      return Result.validationFailed(e.errors());
    }
  }

  private static Result dispatch(String method, String[] seg, Map<String, List<String>> q,
                                 JsonNode body) {
    int n = seg.length;
    switch (method) {
      case "GET" -> {
        switch (n) {
          case 1 -> {
            switch (seg[0]) {
              case "plaintext" -> { return Result.text(200, "Hello, World!"); }
              case "health" -> { return Result.text(200, "ok"); }
              case "__meta" -> { return Result.json(200, meta()); }
              case "products" -> { return Result.json(200, Domain.listProducts(q)); }
              case "customers" -> { return Result.json(200, Domain.listCustomers(q)); }
              case "orders" -> { return Result.json(200, Domain.listOrders(q)); }
              case "search" -> { return Result.json(200, Domain.search(q)); }
              case "dashboard" -> { return Result.json(200, Domain.dashboard()); }
              case "boom" -> throw new Boom();
              case "forbidden" -> { return Result.json(403, Map.of("error", "forbidden")); }
              default -> { }
            }
          }
          case 2 -> {
            if (seg[0].equals("json") && seg[1].equals("small")) {
              return Result.json(200, Domain.jsonSmall());
            }
            switch (seg[0]) {
              case "products" -> { return Result.json(200, Domain.getProduct(seg[1])); }
              case "customers" -> { return Result.json(200, Domain.getCustomer(seg[1])); }
              case "orders" -> { return Result.json(200, Domain.getOrder(seg[1])); }
              default -> { }
            }
          }
          case 3 -> {
            if (seg[0].equals("products") && seg[2].equals("reviews")) {
              return Result.json(200, Domain.getProductReviews(seg[1]));
            }
            if (seg[0].equals("products") && seg[2].equals("related")) {
              return Result.json(200, Domain.relatedProducts(seg[1]));
            }
            if (seg[0].equals("customers") && seg[2].equals("orders")) {
              return Result.json(200, Domain.getCustomerOrders(seg[1]));
            }
            if (seg[0].equals("customers") && seg[2].equals("summary")) {
              return Result.json(200, Domain.customerSummary(seg[1]));
            }
            if (seg[0].equals("orders") && seg[2].equals("lines")) {
              return Result.json(200, Domain.getOrderLines(seg[1]));
            }
            if (seg[0].equals("orders") && seg[2].equals("full")) {
              return Result.json(200, Domain.orderFull(seg[1]));
            }
            if (seg[0].equals("regions") && seg[2].equals("customers")) {
              return Result.json(200, Domain.getRegionCustomers(seg[1]));
            }
            if (seg[0].equals("regions") && seg[2].equals("report")) {
              return Result.json(200, Domain.regionReport(seg[1]));
            }
          }
          case 4 -> {
            if (seg[0].equals("customers") && seg[2].equals("orders")) {
              return Result.json(200, Domain.getCustomerOrder(seg[1], seg[3]));
            }
            if (seg[0].equals("orders") && seg[2].equals("lines")) {
              return Result.json(200, Domain.getOrderLine(seg[1], seg[3]));
            }
          }
          case 8 -> {
            if (seg[0].equals("regions") && seg[2].equals("customers")
                && seg[4].equals("orders") && seg[6].equals("lines")) {
              return Result.json(200, Domain.getOrderLine(seg[5], seg[7]));
            }
          }
          default -> { }
        }
      }
      case "POST" -> {
        switch (n) {
          case 1 -> {
            if (seg[0].equals("echo")) {
              return Result.json(200, Domain.echo(body));
            }
            if (seg[0].equals("orders")) {
              ValidatedOrder v = Domain.validateOrder(body);
              return Result.located(201, v, "/orders/" + Domain.nextOrderId);
            }
          }
          case 2 -> {
            if (seg[1].equals("validate")) {
              switch (seg[0]) {
                case "orders" -> { return Result.json(200, Domain.validateOrder(body)); }
                case "customers" -> { return Result.json(200, Domain.validateCustomer(body)); }
                case "products" -> { return Result.json(200, Domain.validateProduct(body)); }
                default -> { }
              }
            }
          }
          case 3 -> {
            if (seg[0].equals("orders") && seg[2].equals("lines")) {
              int lines = Domain.getOrder(seg[1]).lines().size();
              return Result.located(201, Domain.validateLine(body),
                                    "/orders/" + seg[1] + "/lines/" + (lines + 1));
            }
          }
          default -> { }
        }
      }
      case "PUT" -> {
        if (n == 2 && seg[0].equals("orders")) {
          int id = Domain.getOrder(seg[1]).id();
          ValidatedOrder v = Domain.validateOrder(body);
          return Result.json(200, new ValidatedOrderWithId(id, v.customerId(), v.status(),
                                                           v.lines(), v.totalCents()));
        }
      }
      case "PATCH" -> {
        if (n == 2 && seg[0].equals("customers")) {
          return Result.json(200, Domain.patchCustomer(seg[1], body));
        }
      }
      case "DELETE" -> {
        if (n == 4 && seg[0].equals("orders") && seg[2].equals("lines")) {
          Domain.getOrderLine(seg[1], seg[3]);
          return Result.noContent();
        }
      }
      default -> { }
    }
    return Result.NOT_FOUND;
  }

  public static Map<String, String> meta() {
    return Hosts.meta("bare-netty", Hosts.version("netty"));
  }

  /** Path segments with the empty ones dropped, the same split the go baseline does. */
  public static String[] split(String path) {
    int n = 0;
    int len = path.length();
    for (int i = 0; i < len; i++) {
      if (path.charAt(i) != '/' && (i == 0 || path.charAt(i - 1) == '/')) {
        n++;
      }
    }
    String[] out = new String[n];
    int k = 0;
    int start = -1;
    for (int i = 0; i <= len; i++) {
      if (i < len && path.charAt(i) != '/') {
        if (start < 0) {
          start = i;
        }
      } else if (start >= 0) {
        out[k++] = path.substring(start, i);
        start = -1;
      }
    }
    return out;
  }

  public static boolean hasBody(String method) {
    return method.equals("POST") || method.equals("PUT") || method.equals("PATCH");
  }
}

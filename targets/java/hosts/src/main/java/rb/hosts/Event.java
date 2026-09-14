package rb.hosts;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The pieces every Java target needs to read an API Gateway v2 event, shared so a target
 * that brings no framework adapter is not rewriting them.
 *
 * There is no HTTP anywhere in this path. That is what makes lambda-rie a different
 * invocation model rather than a different server.
 */
public final class Event {
  private Event() {}

  public static String method(APIGatewayV2HTTPEvent event) {
    return event.getRequestContext().getHttp().getMethod();
  }

  public static String path(APIGatewayV2HTTPEvent event) {
    String p = event.getRawPath();
    return p == null ? "/" : p;
  }

  /** Query parameters as the Map the domain takes; the event carries one value per key. */
  public static Map<String, List<String>> query(APIGatewayV2HTTPEvent event) {
    Map<String, String> flat = event.getQueryStringParameters();
    Map<String, List<String>> out = new LinkedHashMap<>();
    if (flat != null) {
      flat.forEach((k, v) -> out.put(k, List.of(v)));
    }
    return out;
  }

  /** The request body as bytes, or null when there is none. */
  public static byte[] bodyBytes(APIGatewayV2HTTPEvent event) {
    String raw = event.getBody();
    if (raw == null || raw.isEmpty()) {
      return null;
    }
    return Boolean.TRUE.equals(event.getIsBase64Encoded())
        ? Base64.getDecoder().decode(raw)
        : raw.getBytes(StandardCharsets.UTF_8);
  }

  public static APIGatewayV2HTTPResponse response(int status, Map<String, String> headers,
                                                  byte[] body) {
    APIGatewayV2HTTPResponse res = new APIGatewayV2HTTPResponse();
    res.setStatusCode(status);
    res.setHeaders(new LinkedHashMap<>(headers));
    res.setBody(body == null ? "" : new String(body, StandardCharsets.UTF_8));
    res.setIsBase64Encoded(false);
    return res;
  }

  /** Path segments with the empty ones dropped. */
  public static String[] segments(String path) {
    List<String> out = new ArrayList<>(8);
    for (String s : path.split("/")) {
      if (!s.isEmpty()) {
        out.add(s);
      }
    }
    return out.toArray(new String[0]);
  }
}

package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.hosts.Hosts;

/** baseline: dispatch floor, no serialization. */
public final class Baseline {
  private Baseline() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/plaintext", (req, res) ->
        res.header("content-type", "text/plain").send("Hello, World!"));

    r.get("/health", (req, res) -> res.header("content-type", "text/plain").send("ok"));

    r.get("/__meta", (req, res) -> res.send(
        Hosts.meta("helidon-se", Hosts.version("helidon"),
                   "thymeleaf " + Hosts.version("thymeleaf"),
                   "sha1 (helidon ships no conditional handling)", "a shared LRU")));
  }
}

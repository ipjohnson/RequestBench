package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.helidon.Reply;
import rb.helidon.Validation;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse. Helidon SE has no validation layer, so the walk
 * this target holds in Validation is what runs, in the handler.
 */
public final class Body {
  private Body() {}

  public static void register(HttpRouting.Builder r) {
    r.post("/body/bind/small", (req, res) -> res.send(Domain.bindEcho(Reply.body(req))));

    r.post("/body/bind/medium", (req, res) -> res.send(Domain.bindEcho(Reply.body(req))));

    r.post("/body/validate/small",
           (req, res) -> res.send(Validation.validated(Reply.body(req), false)));

    r.post("/body/validate/medium",
           (req, res) -> res.send(Validation.validated(Reply.body(req), false)));

    r.post("/body/validate/first-error",
           (req, res) -> res.send(Validation.validated(Reply.body(req), true)));
  }
}

package implementation.routes;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import implementation.Payloads;
import implementation.Serial;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;

/**
 * etag: RoutingContext.etag and RoutingContext.isFresh, Vert.x Web's conditional-request helpers,
 * with the handler computing the tag. Vert.x Web computes none for an answer a handler writes, so
 * the handler hashes the encoded body with SHA-1. The body is built and hashed before anything is
 * compared, so a 304 saves the write and nothing else.
 */
public final class EtagRoutes {

    private EtagRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/etag/small").handler(ctx -> revalidated(ctx, p.small()));

        router.get("/etag/large").handler(ctx -> revalidated(ctx, p.large()));
    }

    // rb:wiring etag.*
    /** Tags the encoded payload and answers 304 with no body when If-None-Match names the tag. */
    private static void revalidated(RoutingContext ctx, JsonObject payload) {
        Serial.write(ctx.response());
        Buffer body = payload.toBuffer();
        ctx.etag(sha1(body));
        if (ctx.isFresh()) {
            ctx.response().setStatusCode(304).end();
            return;
        }
        ctx.response().putHeader(HttpHeaders.CONTENT_TYPE, "application/json").end(body);
    }

    private static String sha1(Buffer body) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(body.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
    // rb:end
}

package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.http.ForbiddenResponse;
import io.javalin.http.Header;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiParam;
import io.javalin.openapi.OpenApiResponse;

/**
 * authorized: a beforeMatched handler on /authorized/*, the hook Javalin's documentation manages
 * access with. A request whose Authorization header is not the bearer token settings.json names is
 * refused with ForbiddenResponse, which Javalin answers with 403 before the route runs.
 */
public final class AuthorizedRoutes {

    private final Payloads p;

    public AuthorizedRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        String bearer = "Bearer " + p.settings().token();
        // rb:handler authorized.denied
        // rb:wiring authorized.*
        config.routes.beforeMatched("/authorized/*", ctx -> {
            if (!bearer.equals(ctx.header(Header.AUTHORIZATION))) {
                throw new ForbiddenResponse();
            }
        });
        config.routes.get("/authorized/small", this::small);
    }

    // rb:handler authorized.allowed
    @OpenApi(path = "/authorized/small",
            headers = @OpenApiParam(name = "Authorization", required = true),
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)), @OpenApiResponse(status = "403")})
    private void small(Context ctx) {
        ctx.json(p.small());
    }
}

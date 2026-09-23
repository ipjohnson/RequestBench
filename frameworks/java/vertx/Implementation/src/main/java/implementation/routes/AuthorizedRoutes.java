package implementation.routes;

import implementation.Payloads;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpHeaders;
import io.vertx.ext.auth.User;
import io.vertx.ext.auth.authorization.Authorization;
import io.vertx.ext.auth.authorization.AuthorizationProvider;
import io.vertx.ext.auth.authorization.PermissionBasedAuthorization;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.AuthorizationHandler;
import io.vertx.ext.web.handler.ErrorHandler;
import io.vertx.ext.web.handler.HttpException;
import io.vertx.ext.web.handler.SimpleAuthenticationHandler;

/**
 * authorized: Vert.x Web's authentication and authorization handlers, on /authorized alone.
 * SimpleAuthenticationHandler makes the bearer token the user, because vertx-auth has no provider
 * for an opaque token. AuthorizationHandler then requires a permission that only settings.json's
 * token is granted, and fails any other user with 403.
 */
public final class AuthorizedRoutes {

    private static final Authorization READ = PermissionBasedAuthorization.create("read");

    private AuthorizedRoutes() {}

    public static void register(Router router, Vertx vertx, Payloads p) {
        String token = p.settings().getString("token");

        // rb:wiring authorized.*
        // Vert.x Web logs a failure that no failure handler takes as an unhandled exception, once
        // per denied request. The route's failures go to Vert.x Web's ErrorHandler instead.
        router.route("/authorized/*")
                .handler(SimpleAuthenticationHandler.create().authenticate(AuthorizedRoutes::bearer))
                .handler(AuthorizationHandler.create(READ).addAuthorizationProvider(new SettingsToken(token)))
                .failureHandler(ErrorHandler.create(vertx));
        // rb:end

        router.get("/authorized/small").handler(ctx -> ctx.json(p.small()));
    }

    // rb:wiring authorized.*
    /** The bearer token as the user. A request without one is not authenticated, which is 401. */
    private static Future<User> bearer(RoutingContext ctx) {
        String authorization = ctx.request().getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Future.failedFuture(new HttpException(401));
        }
        return Future.succeededFuture(User.fromToken(authorization.substring("Bearer ".length())));
    }

    /** Grants READ to the user whose token is settings.json's, and nothing to any other. */
    private record SettingsToken(String token) implements AuthorizationProvider {

        @Override
        public String getId() {
            return "settings.json";
        }

        @Override
        public Future<Void> getAuthorizations(User user) {
            if (token.equals(user.principal().getString("access_token"))) {
                user.authorizations().put(getId(), READ);
            }
            return Future.succeededFuture();
        }
    }
    // rb:end
}

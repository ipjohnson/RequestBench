package implementation.routes;

import implementation.OrderRequest;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.HttpMethod;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiRequestBody;
import io.javalin.openapi.OpenApiResponse;

/**
 * body: the order read with Javalin's JSON mapper. The bind routes read it with ctx.bodyAsClass and
 * check nothing. The validate routes read it through ctx.bodyValidator with orderRequest's rules as
 * checks, and Javalin answers the ValidationException a failed check throws with 400. A body the
 * mapper cannot read fails bodyValidator the same way, under REQUEST_BODY.
 */
public final class BodyRoutes {

    /**
     * What a bind or validate row answers: the order back, with the leaves the handler found in it
     * and the bytes it received.
     */
    public record Bound(int fields, long bytes, OrderRequest echo) {

        /** customerId and status, and a productId and a qty per line. */
        static Bound of(OrderRequest order, Context ctx) {
            return new Bound(2 + 2 * order.lines().size(), ctx.bodyAsBytes().length, order);
        }
    }

    public void register(JavalinConfig config) {
        config.routes.post("/body/bind/small", this::bindSmall);
        config.routes.post("/body/bind/medium", this::bindMedium);
        config.routes.post("/body/validate/small", this::validateSmall);
        config.routes.post("/body/validate/medium", this::validateMedium);
        config.routes.post("/body/validate/first-error", this::validateFirstError);
    }

    // rb:handler body.bind_small
    @OpenApi(path = "/body/bind/small",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = OrderRequest.class), required = true),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Bound.class)))
    private void bindSmall(Context ctx) {
        ctx.json(Bound.of(ctx.bodyAsClass(OrderRequest.class), ctx));
    }

    // rb:handler body.bind_medium
    @OpenApi(path = "/body/bind/medium",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = OrderRequest.class), required = true),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Bound.class)))
    private void bindMedium(Context ctx) {
        ctx.json(Bound.of(ctx.bodyAsClass(OrderRequest.class), ctx));
    }

    // rb:handler body.validate_small,body.rejected_all,errors.malformed
    @OpenApi(path = "/body/validate/small",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = OrderRequest.class), required = true),
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Bound.class)), @OpenApiResponse(status = "400")})
    private void validateSmall(Context ctx) {
        ctx.json(Bound.of(OrderRequest.validated(ctx), ctx));
    }

    // rb:handler body.validate_medium
    @OpenApi(path = "/body/validate/medium",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = OrderRequest.class), required = true),
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Bound.class)), @OpenApiResponse(status = "400")})
    private void validateMedium(Context ctx) {
        ctx.json(Bound.of(OrderRequest.validated(ctx), ctx));
    }

    // rb:handler body.rejected_first
    @OpenApi(path = "/body/validate/first-error",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = OrderRequest.class), required = true),
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Bound.class)), @OpenApiResponse(status = "400")})
    private void validateFirstError(Context ctx) {
        ctx.json(Bound.of(OrderRequest.firstError(ctx), ctx));
    }
}

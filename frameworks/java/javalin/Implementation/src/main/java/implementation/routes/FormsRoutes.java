package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.http.UploadedFile;
import io.javalin.openapi.HttpMethod;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiContentProperty;
import io.javalin.openapi.OpenApiRequestBody;
import io.javalin.openapi.OpenApiResponse;

/**
 * forms: bodies read through Javalin's form support. The urlencoded form is read with
 * ctx.formParamAsClass into query.many's record exactly as the query string is, and the multipart
 * upload's fields with ctx.formParamAsClass and its file part with ctx.uploadedFile, both from the
 * parts Jetty parses.
 */
public final class FormsRoutes {

    public record UploadedPart(String name, long bytes) {}

    public record UploadEcho(String tenant, String requestId) {}

    public record Uploaded(UploadedPart file, UploadEcho echo) {}

    private final Payloads p;

    public FormsRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.post("/forms/urlencoded", this::urlencoded);
        config.routes.post("/forms/multipart", this::multipart);
    }

    // rb:handler forms.urlencoded
    @OpenApi(path = "/forms/urlencoded",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(required = true,
                    content = @OpenApiContent(mimeType = "application/x-www-form-urlencoded", from = Search.class)),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void urlencoded(Context ctx) {
        ctx.json(Echoed.of(p.small(), Search.bind(ctx::formParamAsClass)));
    }

    // rb:handler forms.multipart
    @OpenApi(path = "/forms/multipart",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(required = true,
                    content = @OpenApiContent(mimeType = "multipart/form-data", type = "object", properties = {
                        @OpenApiContentProperty(name = "tenant", type = "string"),
                        @OpenApiContentProperty(name = "requestId", type = "string"),
                        @OpenApiContentProperty(name = "file", type = "string", format = "binary")})),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Uploaded.class)))
    private void multipart(Context ctx) {
        UploadedFile file = ctx.uploadedFile("file");
        UploadEcho echo = new UploadEcho(
                ctx.formParamAsClass("tenant", String.class).get(),
                ctx.formParamAsClass("requestId", String.class).get());
        ctx.json(new Uploaded(new UploadedPart(file.filename(), file.size()), echo));
    }
}

package implementation.routes;

import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.objectSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;

import java.nio.file.Path;

import implementation.Payloads;
import implementation.Validation;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.FileUpload;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.Bodies;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import io.vertx.json.schema.SchemaRepository;
import io.vertx.json.schema.common.dsl.ObjectSchemaBuilder;

/**
 * forms: BodyHandler parses both bodies into the request's form attributes, and a
 * ValidationHandler binds them as a form body, each field parsed to its schema's type, into the
 * JsonObject the route's handler reads. The urlencoded form binds query.many's eight values as
 * the query string does. BodyHandler streams the multipart upload's file part to a file and
 * deletes it once the answer is sent.
 */
public final class FormsRoutes {

    /** Where BodyHandler writes a file part, in place of file-uploads under the working directory. */
    private static final String UPLOADS = Path.of(System.getProperty("java.io.tmpdir"), "file-uploads").toString();

    private FormsRoutes() {}

    public static void register(Router router, Payloads p) {
        SchemaRepository schemas = Validation.repository();

        router.post("/forms/urlencoded").handler(BodyHandler.create(false)).handler(urlencoded(schemas))
                .handler(ctx -> ctx.json(Payloads.echoed(p.small(), Validation.parsed(ctx).body().getJsonObject())));

        router.post("/forms/multipart").handler(BodyHandler.create(UPLOADS).setDeleteUploadedFilesOnEnd(true)).handler(multipart(schemas))
                .handler(ctx -> {
                    FileUpload file = ctx.fileUploads().getFirst();
                    ctx.json(new JsonObject()
                            .put("file", new JsonObject().put("name", file.fileName()).put("bytes", file.size()))
                            .put("echo", Validation.parsed(ctx).body().getJsonObject()));
                });
    }

    // rb:wiring forms.*
    private static ValidationHandler urlencoded(SchemaRepository schemas) {
        ObjectSchemaBuilder search = objectSchema();
        for (String name : QueryRoutes.SEARCH) {
            search.requiredProperty(name, QueryRoutes.NUMBERS.contains(name) ? intSchema() : stringSchema());
        }
        return ValidationHandlerBuilder.create(schemas).body(Bodies.formUrlEncoded(search)).build();
    }

    private static ValidationHandler multipart(SchemaRepository schemas) {
        return ValidationHandlerBuilder.create(schemas)
                .body(Bodies.multipartFormData(objectSchema()
                        .requiredProperty("tenant", stringSchema())
                        .requiredProperty("requestId", stringSchema())))
                .build();
    }
    // rb:end
}

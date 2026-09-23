package implementation;

import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.SchemaRepository;

/**
 * What every ValidationHandler here is built with, and how a handler reads what one parsed.
 * vertx-web-validation is Vert.x's facility for binding a parameter or a body to a type: the
 * handler parses and checks each declared value against a JSON schema before the route's own
 * handler runs, and refuses the request with 400 when one does not fit.
 */
public final class Validation {

    private Validation() {}

    // rb:wiring body.*,parameters.*,query.*,headers.*,forms.*
    /**
     * A repository for one family's schemas. The schema DSL writes Draft 7. Basic output lists
     * every error the validator finds. The default, Flag, stops at the first and says only that
     * the value is invalid.
     */
    public static SchemaRepository repository() {
        return SchemaRepository.create(new JsonSchemaOptions()
                .setDraft(Draft.DRAFT7)
                .setOutputFormat(OutputFormat.Basic)
                .setBaseUri("https://requestbench.invalid/"));
    }

    /** The values the route's ValidationHandler parsed. */
    public static RequestParameters parsed(RoutingContext ctx) {
        return ctx.get(ValidationHandler.REQUEST_CONTEXT_KEY);
    }
    // rb:end
}

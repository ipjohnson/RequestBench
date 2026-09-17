using System.Text.Json;
using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// body: the parser and the validator, with size crossed against validation.
///
/// The framework parses and binds the request body, so a body it cannot read fails inside
/// the framework rather than in the domain; Failures turns that into the shared 422.
///
/// bind parses and binds without validating, so validate minus bind is the validator alone
/// rather than the validator plus the parse.
/// </summary>
public static class Body
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/body/bind/small", (JsonElement body) => DomainModel.BindEcho(body));

        app.MapPost("/body/bind/medium", (JsonElement body) => DomainModel.BindEcho(body));

        // The parameter's type is the wiring: AddValidation() has the framework check its
        // DataAnnotations before the handler runs, so a body that fails never reaches one.
        app.MapPost("/body/validate/small",
                    (OrderIn body, DomainModel d) => Priced(d, body));

        app.MapPost("/body/validate/medium",
                    (OrderIn body, DomainModel d) => Priced(d, body));

        // DataAnnotations reports every attribute that failed and offers no mode that stops
        // at the first, so this row answers what the framework answers.
        app.MapPost("/body/validate/first-error",
                    (OrderIn body, DomainModel d) => Priced(d, body));
    }

    /// <summary>The order, once the framework's validator has said the body is one.</summary>
    internal static ValidatedOrder Priced(DomainModel d, OrderIn body) =>
        d.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
}

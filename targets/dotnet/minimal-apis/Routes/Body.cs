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

        app.MapPost("/body/validate/small",
                    (JsonElement body, DomainModel d) => d.ValidateOrder(body));

        app.MapPost("/body/validate/medium",
                    (JsonElement body, DomainModel d) => d.ValidateOrder(body));

        app.MapPost("/body/validate/first-error",
                    (JsonElement body, DomainModel d) => d.ValidateOrder(body, firstError: true));
    }
}

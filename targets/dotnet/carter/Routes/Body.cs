using System.Text.Json;
using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// body: the parser and the validator, with size crossed against validation.
///
/// The framework parses and binds the request body, so a body it cannot read fails inside
/// the framework rather than in the domain; Failures turns that into a 400.
///
/// bind parses and binds without validating, so validate minus bind is the validator alone
/// rather than the validator plus the parse.
/// </summary>
public sealed class Body : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/body/bind/small", (JsonElement body) => DomainModel.BindEcho(body));

        app.MapPost("/body/bind/medium", (JsonElement body) => DomainModel.BindEcho(body));

        // Carter's MapPost<T> puts Carter's endpoint filter on the route. The filter finds the
        // validator for OrderBody and answers 422 with its failures before the handler runs.
        app.MapPost<OrderBody>("/body/validate/small",
                               (OrderBody body, DomainModel d) => Priced(d, body));

        app.MapPost<OrderBody>("/body/validate/medium",
                               (OrderBody body, DomainModel d) => Priced(d, body));

        // FluentValidation collects every rule that failed. Its CascadeMode would stop at the
        // first, but that is a property of the validator rather than of this endpoint, so
        // this row answers what the one validator answers.
        app.MapPost<OrderBody>("/body/validate/first-error",
                               (OrderBody body, DomainModel d) => Priced(d, body));
    }

    /// <summary>The order priced, once Carter's filter has let the body through.</summary>
    // rb:wiring body.*,domain.*
    internal static ValidatedOrder Priced(DomainModel d, OrderBody body) =>
        d.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
}

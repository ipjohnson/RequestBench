using System.Text.Json;
using FluentValidation;
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

        // Carter has no hook that would run a validator for us, so the route runs it. The
        // rules still live in one place -- OrderBodyValidator -- rather than being walked by
        // hand in each handler.
        app.MapPost("/body/validate/small",
                    (OrderBody body, DomainModel d, IValidator<OrderBody> v) => Priced(v, d, body));

        app.MapPost("/body/validate/medium",
                    (OrderBody body, DomainModel d, IValidator<OrderBody> v) => Priced(v, d, body));

        // FluentValidation collects every rule that failed. Its CascadeMode would stop at the
        // first, but that is a property of the validator rather than of this endpoint, so
        // this row answers what the one validator answers.
        app.MapPost("/body/validate/first-error",
                    (OrderBody body, DomainModel d, IValidator<OrderBody> v) => Priced(v, d, body));
    }

    /// <summary>
    /// Runs the validator and answers its failures, or prices the order. FluentValidation
    /// reports the property and its own message, which is its vocabulary rather than this
    /// repository's.
    /// </summary>
    internal static IResult Priced(IValidator<OrderBody> validator, DomainModel d, OrderBody body) =>
        Refused(validator, body)
        ?? Results.Ok(d.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input()));

    /// <summary>
    /// What the validator refused, or null when it accepted the body. The writes share this
    /// so a body is validated the same way whichever route took it.
    /// </summary>
    internal static IResult? Refused(IValidator<OrderBody> validator, OrderBody body)
    {
        FluentValidation.Results.ValidationResult result = validator.Validate(body);
        return result.IsValid
            ? null
            : Results.ValidationProblem(
                result.Errors
                      .GroupBy(e => e.PropertyName)
                      .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()),
                statusCode: 400);
    }
}

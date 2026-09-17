using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// body: the parser and the validator, with size crossed against validation.
///
/// The body is a declared parameter, so Wolverine binds it. Everything else on the
/// signature is marked [FromServices]: Wolverine reads the request body out of the first
/// parameter it does not recognise, and an endpoint that advertises a body on a method that
/// cannot carry one is dropped from route matching and answers a bare 404.
///
/// bind parses and binds without validating, so validate minus bind is the validator alone
/// rather than the validator plus the parse.
/// </summary>
public static class BodyEndpoints
{
    [WolverinePost("/body/bind/small")]
    public static BindResult BindSmall(JsonElement body) => DomainModel.BindEcho(body);

    [WolverinePost("/body/bind/medium")]
    public static BindResult BindMedium(JsonElement body) => DomainModel.BindEcho(body);

    // The request type is the wiring: Wolverine's FluentValidation middleware finds a
    // validator for it and runs it before the method is entered, so a body that fails never
    // reaches one.
    [WolverinePost("/body/validate/small")]
    public static ValidatedOrder ValidateSmall(OrderBody body,
                                               [FromServices] DomainModel domain) =>
        domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());

    [WolverinePost("/body/validate/medium")]
    public static ValidatedOrder ValidateMedium(OrderBody body,
                                                [FromServices] DomainModel domain) =>
        domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());

    // FluentValidation collects every rule that failed, and the middleware runs the one
    // validator, so this row answers what Wolverine answers.
    [WolverinePost("/body/validate/first-error")]
    public static ValidatedOrder ValidateFirst(OrderBody body,
                                               [FromServices] DomainModel domain) =>
        domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
}

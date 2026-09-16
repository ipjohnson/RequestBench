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

    [WolverinePost("/body/validate/small")]
    public static ValidatedOrder ValidateSmall(JsonElement body,
                                               [FromServices] DomainModel domain) =>
        domain.ValidateOrder(body);

    [WolverinePost("/body/validate/medium")]
    public static ValidatedOrder ValidateMedium(JsonElement body,
                                                [FromServices] DomainModel domain) =>
        domain.ValidateOrder(body);

    [WolverinePost("/body/validate/first-error")]
    public static ValidatedOrder ValidateFirst(JsonElement body,
                                               [FromServices] DomainModel domain) =>
        domain.ValidateOrder(body, firstError: true);
}

using System.Text.Json;
using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// body: the parser and the validator, with size crossed against validation.
///
/// The document is read rather than bound to a DTO, because the endpoint set needs the raw
/// JSON for the validator to produce the exact field errors every other target produces.
/// The read is still the framework's, and a body it cannot read raises the shared 422.
///
/// bind parses and binds without validating, so validate minus bind is the validator alone
/// rather than the validator plus the parse.
/// </summary>
public sealed class BindSmallEndpoint : EndpointWithoutRequest<BindResult>
{
    public override void Configure()
    {
        Post("/body/bind/small");
        AllowAnonymous();
    }

    public override async Task<BindResult> ExecuteAsync(CancellationToken ct) =>
        DomainModel.BindEcho(await Support.Body(HttpContext.Request, ct));
}

public sealed class BindMediumEndpoint : EndpointWithoutRequest<BindResult>
{
    public override void Configure()
    {
        Post("/body/bind/medium");
        AllowAnonymous();
    }

    public override async Task<BindResult> ExecuteAsync(CancellationToken ct) =>
        DomainModel.BindEcho(await Support.Body(HttpContext.Request, ct));
}

public sealed class ValidateSmallEndpoint(DomainModel domain) : EndpointWithoutRequest<ValidatedOrder>
{
    public override void Configure()
    {
        Post("/body/validate/small");
        AllowAnonymous();
    }

    public override async Task<ValidatedOrder> ExecuteAsync(CancellationToken ct) =>
        domain.ValidateOrder(await Support.Body(HttpContext.Request, ct));
}

public sealed class ValidateMediumEndpoint(DomainModel domain) : EndpointWithoutRequest<ValidatedOrder>
{
    public override void Configure()
    {
        Post("/body/validate/medium");
        AllowAnonymous();
    }

    public override async Task<ValidatedOrder> ExecuteAsync(CancellationToken ct) =>
        domain.ValidateOrder(await Support.Body(HttpContext.Request, ct));
}

public sealed class ValidateFirstEndpoint(DomainModel domain) : EndpointWithoutRequest<ValidatedOrder>
{
    public override void Configure()
    {
        Post("/body/validate/first-error");
        AllowAnonymous();
    }

    public override async Task<ValidatedOrder> ExecuteAsync(CancellationToken ct) =>
        domain.ValidateOrder(await Support.Body(HttpContext.Request, ct), firstError: true);
}

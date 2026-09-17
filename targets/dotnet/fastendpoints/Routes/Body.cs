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
/// rather than the validator plus the parse. Validating is FastEndpoints' own: a
/// Validator&lt;TRequest&gt; is discovered and run against the bound request before the
/// handler is entered, so no handler calls a validator.
/// </summary>
// rb:handler body.bind_small
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

// rb:handler body.bind_medium
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

// rb:handler body.validate_small,body.rejected_all,errors.malformed
public sealed class ValidateSmallEndpoint(DomainModel domain) : Endpoint<OrderRequest, ValidatedOrder>
{
    public override void Configure()
    {
        Post("/body/validate/small");
        AllowAnonymous();
    }

    public override Task<ValidatedOrder> ExecuteAsync(OrderRequest req, CancellationToken ct) =>
        Task.FromResult(domain.PriceOrder(req.CustomerId!.Value, req.Status!, req.Input()));
}

// rb:handler body.validate_medium
public sealed class ValidateMediumEndpoint(DomainModel domain) : Endpoint<OrderRequest, ValidatedOrder>
{
    public override void Configure()
    {
        Post("/body/validate/medium");
        AllowAnonymous();
    }

    public override Task<ValidatedOrder> ExecuteAsync(OrderRequest req, CancellationToken ct) =>
        Task.FromResult(domain.PriceOrder(req.CustomerId!.Value, req.Status!, req.Input()));
}

// rb:handler body.rejected_first
public sealed class ValidateFirstEndpoint(DomainModel domain) : Endpoint<OrderRequest, ValidatedOrder>
{
    // FluentValidation collects every rule that failed. FastEndpoints exposes no
    // fail-fast mode short of throwing from the first rule, so this row answers what
    // the framework answers.
    public override void Configure()
    {
        Post("/body/validate/first-error");
        AllowAnonymous();
    }

    public override Task<ValidatedOrder> ExecuteAsync(OrderRequest req, CancellationToken ct) =>
        Task.FromResult(domain.PriceOrder(req.CustomerId!.Value, req.Status!, req.Input()));
}

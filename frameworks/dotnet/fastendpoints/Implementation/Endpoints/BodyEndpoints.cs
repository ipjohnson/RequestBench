using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// body: the order bound by FastEndpoints and validated by it. FastEndpoints runs the Validator
/// declared for an endpoint's request type before the handler, and answers 400 with its
/// ErrorResponse when a rule fails. A body the serializer cannot read never reaches the
/// validator, and FastEndpoints answers it with the same 400 and ErrorResponse.
/// </summary>
// rb:handler body.bind_small
public sealed class BindSmallEndpoint : Endpoint<OrderRequest, Bound>
{
    public override void Configure() => Post("/body/bind/small");

    public override Task HandleAsync(OrderRequest req, CancellationToken ct) => Send.OkAsync(Bound.Of(req, HttpContext.Request), ct);
}

// rb:handler body.bind_medium
public sealed class BindMediumEndpoint : Endpoint<OrderRequest, Bound>
{
    public override void Configure() => Post("/body/bind/medium");

    public override Task HandleAsync(OrderRequest req, CancellationToken ct) => Send.OkAsync(Bound.Of(req, HttpContext.Request), ct);
}

// rb:handler body.validate_small,body.rejected_all,errors.malformed
public sealed class ValidateSmallEndpoint : Endpoint<CheckedOrder, Bound>
{
    public override void Configure() => Post("/body/validate/small");

    public override Task HandleAsync(CheckedOrder req, CancellationToken ct) => Send.OkAsync(Bound.Of(req, HttpContext.Request), ct);
}

// rb:handler body.validate_medium
public sealed class ValidateMediumEndpoint : Endpoint<CheckedOrder, Bound>
{
    public override void Configure() => Post("/body/validate/medium");

    public override Task HandleAsync(CheckedOrder req, CancellationToken ct) => Send.OkAsync(Bound.Of(req, HttpContext.Request), ct);
}

// rb:handler body.rejected_first
public sealed class ValidateFirstErrorEndpoint : Endpoint<FirstErrorOrder, Bound>
{
    public override void Configure() => Post("/body/validate/first-error");

    public override Task HandleAsync(FirstErrorOrder req, CancellationToken ct) => Send.OkAsync(Bound.Of(req, HttpContext.Request), ct);
}

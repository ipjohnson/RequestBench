using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// body: the order read from the body by Wolverine, which deserialises the first parameter of a
/// type it has no other source for. The validate routes read a type that has a FluentValidation
/// validator, so Wolverine's middleware runs it in the generated handler before the method and
/// answers 400 with its failures. A body Wolverine cannot read never reaches the validator, and
/// is answered with Wolverine's own 400.
/// </summary>
public static class BodyEndpoints
{
    [WolverinePost("/body/bind/small")]
    public static Bound BindSmall(OrderRequest order, HttpRequest request) => Bound.Of(order, request);

    [WolverinePost("/body/bind/medium")]
    public static Bound BindMedium(OrderRequest order, HttpRequest request) => Bound.Of(order, request);

    [WolverinePost("/body/validate/small")]
    public static Bound ValidateSmall(ValidatedOrder order, HttpRequest request) => Bound.Of(order, request);

    [WolverinePost("/body/validate/medium")]
    public static Bound ValidateMedium(ValidatedOrder order, HttpRequest request) => Bound.Of(order, request);

    [WolverinePost("/body/validate/first-error")]
    public static Bound ValidateFirstError(FirstErrorOrder order, HttpRequest request) => Bound.Of(order, request);
}

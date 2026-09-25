using Hardened.Requests.Abstract.Execution;
using Hardened.Requests.Runtime.Validation;
using Hardened.Web.Runtime.Attributes;
using ValidationModules;

namespace Implementation.Controllers;

/// <summary>
/// body: the order bound from JSON on every route. Hardened checks its constraints before a
/// validate route's handler runs and answers 400 with every failure. The bind routes mark the order
/// [ValidateNever], so they parse and bind it and check nothing. A body that does not parse is
/// refused by the binder with the same 400, naming the body parameter.
/// </summary>
public static class BodyController
{
    [Post("/body/bind/small")]
    public static Bound BindSmall([ValidateNever] OrderRequest order, IExecutionRequest request) => Bound.Of(order, request);

    [Post("/body/bind/medium")]
    public static Bound BindMedium([ValidateNever] OrderRequest order, IExecutionRequest request) => Bound.Of(order, request);

    [Post("/body/validate/small")]
    public static Bound ValidateSmall(OrderRequest order, IExecutionRequest request) => Bound.Of(order, request);

    [Post("/body/validate/medium")]
    public static Bound ValidateMedium(OrderRequest order, IExecutionRequest request) => Bound.Of(order, request);

    [Post("/body/validate/first-error")]
    [ValidationMode(ValidationStopMode.StopOnFirstError)]
    public static Bound ValidateFirstError(OrderRequest order, IExecutionRequest request) => Bound.Of(order, request);
}

using Hardened.Requests.Runtime.Validation;
using Hardened.Web.Runtime.Attributes;
using ValidationModules;

namespace Implementation.Routes;

/// <summary>
/// body: the order bound from the JSON body. The validate routes take ValidatedOrder, whose
/// constraints Hardened checks after the bind and before the handler, answering 400 with every
/// failure, or with the first on the first-error route. A body that is not JSON never reaches the
/// check. The binder answers it with the same 400, naming the body parameter.
/// </summary>
public class BodyRoutes
{
    [Post("/body/bind/small")]
    public Bound<OrderRequest> BindSmall(OrderRequest order, [FromHeader("Content-Length")] long bytes) => Bound.Of(order, bytes);

    [Post("/body/bind/medium")]
    public Bound<OrderRequest> BindMedium(OrderRequest order, [FromHeader("Content-Length")] long bytes) => Bound.Of(order, bytes);

    [Post("/body/validate/small")]
    public Bound<ValidatedOrder> ValidateSmall(ValidatedOrder order, [FromHeader("Content-Length")] long bytes) => Bound.Of(order, bytes);

    [Post("/body/validate/medium")]
    public Bound<ValidatedOrder> ValidateMedium(ValidatedOrder order, [FromHeader("Content-Length")] long bytes) => Bound.Of(order, bytes);

    // rb:wiring body.*
    [Post("/body/validate/first-error")]
    [ValidationMode(ValidationStopMode.StopOnFirstError)]
    public Bound<ValidatedOrder> FirstError(ValidatedOrder order, [FromHeader("Content-Length")] long bytes) => Bound.Of(order, bytes);
}

using Carter;

namespace Implementation.Routes;

/// <summary>
/// body: the order bound by minimal APIs, and validated by Carter. MapPost&lt;T&gt; puts Carter's
/// validation filter on a route, which runs the FluentValidation validator for T and answers
/// 422 with its failures before the handler runs. A body the binder cannot read never reaches
/// the filter, and is answered with the binder's own 400.
/// </summary>
public sealed class BodyRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/body/bind/small", (OrderRequest order, HttpRequest request) => Bound.Of(order, request));

        app.MapPost("/body/bind/medium", (OrderRequest order, HttpRequest request) => Bound.Of(order, request));

        app.MapPost<OrderRequest>("/body/validate/small", (OrderRequest order, HttpRequest request) => Bound.Of(order, request));

        app.MapPost<OrderRequest>("/body/validate/medium", (OrderRequest order, HttpRequest request) => Bound.Of(order, request));

        app.MapPost<FirstErrorOrder>("/body/validate/first-error", (FirstErrorOrder order, HttpRequest request) => Bound.Of(order, request));
    }
}

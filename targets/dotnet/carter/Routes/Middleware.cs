using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
///
/// An endpoint filter is the per-route layer Carter inherits from minimal APIs, which is
/// the scoping the family needs. Middleware added to the application would run on all
/// forty-five endpoints. Each layer calls the next and does nothing else.
/// </summary>
public sealed class Middleware : ICarterModule
{
    private static ValueTask<object?> Noop(EndpointFilterInvocationContext context,
                                           EndpointFilterDelegate next) => next(context);

    private static RouteHandlerBuilder Layers(RouteHandlerBuilder route, int n)
    {
        for (int i = 0; i < n; i++)
        {
            route.AddEndpointFilter(Noop);
        }
        return route;
    }

    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/middleware/none", (DomainModel d) => d.Payload("small"));

        Layers(app.MapGet("/middleware/four", (DomainModel d) => d.Payload("small")), 4);

        Layers(app.MapGet("/middleware/sixteen", (DomainModel d) => d.Payload("small")), 16);
    }
}

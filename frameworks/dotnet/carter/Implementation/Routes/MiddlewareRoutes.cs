using Carter;

namespace Implementation.Routes;

/// <summary>
/// middleware: no-op layers in front of the handler. An endpoint filter is the per-route
/// layer Carter inherits from minimal APIs. Middleware added to the application would run
/// on every route rather than on these two.
/// </summary>
public sealed class MiddlewareRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/middleware/none", (Payloads p) => p.Small);

        Layers(app.MapGet("/middleware/four", (Payloads p) => p.Small), 4);

        Layers(app.MapGet("/middleware/sixteen", (Payloads p) => p.Small), 16);
    }

    // rb:wiring middleware.*
    private static ValueTask<object?> Noop(EndpointFilterInvocationContext context, EndpointFilterDelegate next) => next(context);

    private static void Layers(RouteHandlerBuilder route, int count)
    {
        for (int i = 0; i < count; i++)
        {
            route.AddEndpointFilter(Noop);
        }
    }
    // rb:end
}

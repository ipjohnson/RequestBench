using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
///
/// An endpoint filter is minimal APIs' own per-route layer, which is the scoping the family
/// needs. Middleware added to the application would run on all forty-five endpoints. Each
/// layer calls the next and does nothing else.
/// </summary>
public static class Middleware
{
    // rb:wiring middleware.*
    private static ValueTask<object?> Noop(EndpointFilterInvocationContext context,
                                           EndpointFilterDelegate next) => next(context);

    // rb:wiring middleware.*
    private static RouteHandlerBuilder Layers(RouteHandlerBuilder route, int n)
    {
        for (int i = 0; i < n; i++)
        {
            route.AddEndpointFilter(Noop);
        }
        return route;
    }

    public static void Map(WebApplication app)
    {
        app.MapGet("/middleware/none", (DomainModel d) => d.Payload("small"));

        Layers(app.MapGet("/middleware/four", (DomainModel d) => d.Payload("small")), 4);

        Layers(app.MapGet("/middleware/sixteen", (DomainModel d) => d.Payload("small")), 16);
    }
}

using Carter;

namespace Implementation.Routes;

/// <summary>
/// parameters: router captures, each bound by naming a handler parameter after it, as the
/// integer its type says. Routing prefers the literal segment of the static route.
/// </summary>
public sealed class ParametersRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/parameters/static/segment/literal", (Payloads p) => p.Small);

        app.MapGet("/parameters/{one}/segment/literal", (int one, Payloads p) => new Echoed<ParametersOne>(p.Small, new(one)));

        app.MapGet("/parameters/{one}/with-second/{two}", (int one, int two, Payloads p) => new Echoed<ParametersTwo>(p.Small, new(one, two)));
    }
}

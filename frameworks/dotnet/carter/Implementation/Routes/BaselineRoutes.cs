using Carter;

namespace Implementation.Routes;

/// <summary>baseline: the dispatch floor, with nothing serialised.</summary>
public sealed class BaselineRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/plaintext", () => Results.Text("Hello, World!"));
    }
}

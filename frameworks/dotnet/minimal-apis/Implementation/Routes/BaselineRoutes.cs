namespace Implementation.Routes;

/// <summary>baseline: the dispatch floor, with nothing serialised.</summary>
public static class BaselineRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/plaintext", () => Results.Text("Hello, World!"));
    }
}

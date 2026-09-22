namespace Implementation.Routes;

/// <summary>json: a payload the framework already holds, serialised at three sizes.</summary>
public static class JsonRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/json/small", (Payloads p) => p.Small);

        app.MapGet("/json/medium", (Payloads p) => p.Medium);

        app.MapGet("/json/large", (Payloads p) => p.Large);
    }
}

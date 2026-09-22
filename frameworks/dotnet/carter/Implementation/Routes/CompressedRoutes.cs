using Carter;

namespace Implementation.Routes;

/// <summary>
/// compressed: these routes answer like any other. ASP.NET Core's response compression,
/// installed on the whole application, gzips the answer when the request asks for it.
/// </summary>
public sealed class CompressedRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/compressed/small", (HttpResponse response, Payloads p) => Fresh(response, p.Small));

        app.MapGet("/compressed/large", (HttpResponse response, Payloads p) => Fresh(response, p.Large));
    }

    private static Payload Fresh(HttpResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

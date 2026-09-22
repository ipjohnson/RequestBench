namespace Implementation.Routes;

/// <summary>
/// compressed: these routes answer like any other. ASP.NET Core's response compression,
/// installed on the whole application, gzips the answer when the request asks for it.
/// </summary>
public static class CompressedRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/compressed/small", (HttpResponse response, Payloads p) => Fresh(response, p.Small)).DisableValidation();

        app.MapGet("/compressed/large", (HttpResponse response, Payloads p) => Fresh(response, p.Large)).DisableValidation();
    }

    private static Payload Fresh(HttpResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

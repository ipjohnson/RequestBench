using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// compressed: these routes answer like any other. ASP.NET Core's response compression,
/// installed on the whole application, gzips the answer when the request asks for it.
/// </summary>
public static class CompressedEndpoints
{
    [WolverineGet("/compressed/small")]
    public static Payload Small(HttpResponse response, Payloads p) => Fresh(response, p.Small);

    [WolverineGet("/compressed/large")]
    public static Payload Large(HttpResponse response, Payloads p) => Fresh(response, p.Large);

    private static Payload Fresh(HttpResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

using Microsoft.AspNetCore.Cors;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// cors: ASP.NET Core's CORS feature, attached to this one route by [EnableCors], which Wolverine
/// copies onto the route. It answers a preflight before any handler runs. The handler writes
/// x-rb-serial, so its absence on a preflight shows the feature answered alone.
/// </summary>
public static class CorsEndpoints
{
    [WolverineGet("/cors/small")]
    [EnableCors(Policies.Cors)]
    public static Payload Small(HttpResponse response, Payloads p)
    {
        Serial.Write(response);
        return p.Small;
    }
}

using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Cors;

namespace Implementation.Controllers;

/// <summary>
/// cors: [Cors&lt;Shop&gt;] limits Hardened's CORS to this route, with the policy settings.json
/// gives. Hardened answers a preflight before routing and no handler runs. The handler writes
/// x-rb-serial, so its absence on a preflight shows the filter answered alone.
/// </summary>
public static class CorsController
{
    // rb:wiring cors.*
    [Get("/cors/small")]
    [Cors<Shop>]
    public static Payload Small(IExecutionResponse response, IPayloads p)
    {
        Serial.Write(response);
        return p.Small;
    }
}

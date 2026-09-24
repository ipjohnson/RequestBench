using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Cors;

namespace Implementation.Routes;

/// <summary>
/// cors: [Cors&lt;Shop&gt;] limits CORS to this route and answers it with the policy settings.json
/// describes. Hardened answers a preflight before routing, so no handler runs for it. The handler
/// writes x-rb-serial, so its absence on a preflight shows the feature answered alone.
/// </summary>
public class CorsRoutes(Payloads payloads)
{
    [Get("/cors/small")]
    [Cors<Shop>]
    public Payload Small(IExecutionContext context)
    {
        Serial.Write(context.Response);
        return payloads.Small;
    }
}

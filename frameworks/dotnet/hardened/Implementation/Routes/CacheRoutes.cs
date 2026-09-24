using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// cache: Hardened's response cache, which stores the whole answer and replays it before the
/// request is bound. ImplementationLibrary puts its filter on these routes with the lifetime and
/// the vary headers settings.json gives. The handler writes x-rb-serial, so a replayed answer
/// repeats the serial it was stored with.
/// </summary>
public class CacheRoutes(Payloads payloads)
{
    [Get("/cache/small")]
    public Payload Small(IExecutionContext context) => Stored(context, payloads.Small);

    [Get("/cache/medium")]
    public Payload Medium(IExecutionContext context) => Stored(context, payloads.Medium);

    [Get("/cache/large")]
    public Payload Large(IExecutionContext context) => Stored(context, payloads.Large);

    [Get("/cache/vary/one")]
    public Payload VaryOne(IExecutionContext context) => Stored(context, payloads.Small);

    [Get("/cache/vary/many")]
    public Payload VaryMany(IExecutionContext context) => Stored(context, payloads.Small);

    private static Payload Stored(IExecutionContext context, Payload payload)
    {
        Serial.Write(context.Response);
        return payload;
    }
}

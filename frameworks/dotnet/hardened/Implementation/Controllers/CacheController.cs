using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// cache: Hardened's response cache, which ImplementationLibrary puts on these routes. It stores
/// the whole answer and replays it before the handler is reached. The handler writes x-rb-serial,
/// so a replayed answer repeats the serial it was stored with.
/// </summary>
public static class CacheController
{
    [Get("/cache/small")]
    public static Payload Small(IExecutionResponse response, IPayloads p) => Stored(response, p.Small);

    [Get("/cache/medium")]
    public static Payload Medium(IExecutionResponse response, IPayloads p) => Stored(response, p.Medium);

    [Get("/cache/large")]
    public static Payload Large(IExecutionResponse response, IPayloads p) => Stored(response, p.Large);

    [Get("/cache/vary/one")]
    public static Payload VaryOne(IExecutionResponse response, IPayloads p) => Stored(response, p.Small);

    [Get("/cache/vary/many")]
    public static Payload VaryMany(IExecutionResponse response, IPayloads p) => Stored(response, p.Small);

    private static Payload Stored(IExecutionResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

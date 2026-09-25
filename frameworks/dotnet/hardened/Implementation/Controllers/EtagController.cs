using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Conditional;

namespace Implementation.Controllers;

/// <summary>
/// etag: [ConditionalGet] holds the body the handler produced, sets ETag to its SHA-256, and
/// answers 304 when If-None-Match names it. The handler runs on every request, so a 304 saves the
/// write and nothing else.
/// </summary>
public static class EtagController
{
    [Get("/etag/small")]
    [ConditionalGet]
    public static Payload Small(IExecutionResponse response, IPayloads p) => Fresh(response, p.Small);

    [Get("/etag/large")]
    [ConditionalGet]
    public static Payload Large(IExecutionResponse response, IPayloads p) => Fresh(response, p.Large);

    private static Payload Fresh(IExecutionResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

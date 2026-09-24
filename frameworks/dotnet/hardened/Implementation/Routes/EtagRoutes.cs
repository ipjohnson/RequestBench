using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Conditional;

namespace Implementation.Routes;

/// <summary>
/// etag: [ConditionalGet] holds the body the handler writes, sets ETag to its SHA-256, and answers
/// 304 when If-None-Match names it. The handler runs on every request, so a 304 saves the write
/// and nothing else.
/// </summary>
public class EtagRoutes(Payloads payloads)
{
    [Get("/etag/small")]
    [ConditionalGet]
    public Payload Small(IExecutionContext context) => Fresh(context, payloads.Small);

    [Get("/etag/large")]
    [ConditionalGet]
    public Payload Large(IExecutionContext context) => Fresh(context, payloads.Large);

    private static Payload Fresh(IExecutionContext context, Payload payload)
    {
        Serial.Write(context.Response);
        return payload;
    }
}

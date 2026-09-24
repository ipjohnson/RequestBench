using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Compression;

namespace Implementation.Routes;

/// <summary>
/// compressed: [Compress] puts Hardened's compression filter on these two handlers, which gzips
/// the answer when the request's Accept-Encoding names gzip.
/// </summary>
public class CompressedRoutes(Payloads payloads)
{
    [Get("/compressed/small")]
    [Compress]
    public Payload Small(IExecutionContext context) => Fresh(context, payloads.Small);

    [Get("/compressed/large")]
    [Compress]
    public Payload Large(IExecutionContext context) => Fresh(context, payloads.Large);

    private static Payload Fresh(IExecutionContext context, Payload payload)
    {
        Serial.Write(context.Response);
        return payload;
    }
}

using Hardened.Requests.Abstract.Execution;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Compression;

namespace Implementation.Controllers;

/// <summary>
/// compressed: [Compress] puts Hardened's response compression on these two routes, which gzips
/// the answer when the request accepts it.
/// </summary>
public static class CompressedController
{
    [Get("/compressed/small")]
    [Compress]
    public static Payload Small(IExecutionResponse response, IPayloads p) => Fresh(response, p.Small);

    [Get("/compressed/large")]
    [Compress]
    public static Payload Large(IExecutionResponse response, IPayloads p) => Fresh(response, p.Large);

    private static Payload Fresh(IExecutionResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>middleware: no-op filters in front of the handler, none, four or sixteen of them.</summary>
public static class MiddlewareController
{
    [Get("/middleware/none")]
    public static Payload None(IPayloads p) => p.Small;

    [Get("/middleware/four")]
    [Layers(4)]
    public static Payload Four(IPayloads p) => p.Small;

    [Get("/middleware/sixteen")]
    [Layers(16)]
    public static Payload Sixteen(IPayloads p) => p.Small;
}

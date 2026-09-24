using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// middleware: no-op layers in front of the handler. Each is a filter that [Layers] puts on the
/// handler it is written on.
/// </summary>
public class MiddlewareRoutes(Payloads payloads)
{
    [Get("/middleware/none")]
    public Payload None() => payloads.Small;

    [Get("/middleware/four")]
    [Layers(4)]
    public Payload Four() => payloads.Small;

    [Get("/middleware/sixteen")]
    [Layers(16)]
    public Payload Sixteen() => payloads.Small;
}

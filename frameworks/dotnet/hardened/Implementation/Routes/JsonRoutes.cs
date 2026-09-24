using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>json: a payload the framework already holds, serialised at three sizes.</summary>
public class JsonRoutes(Payloads payloads)
{
    [Get("/json/small")]
    public Payload Small() => payloads.Small;

    [Get("/json/medium")]
    public Payload Medium() => payloads.Medium;

    [Get("/json/large")]
    public Payload Large() => payloads.Large;
}

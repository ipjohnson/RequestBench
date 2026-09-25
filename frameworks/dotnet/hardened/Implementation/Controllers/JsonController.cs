using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>json: a payload the framework already holds, serialised at three sizes.</summary>
public static class JsonController
{
    [Get("/json/small")]
    public static Payload Small(IPayloads p) => p.Small;

    [Get("/json/medium")]
    public static Payload Medium(IPayloads p) => p.Medium;

    [Get("/json/large")]
    public static Payload Large(IPayloads p) => p.Large;
}

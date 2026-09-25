using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// parameters: path tokens, each bound to the handler parameter of the same name as an integer.
/// The routing table tries the literal segment of the static route before a token.
/// </summary>
public static class ParametersController
{
    [Get("/parameters/static/segment/literal")]
    public static Payload Static(IPayloads p) => p.Small;

    [Get("/parameters/{one}/segment/literal")]
    public static Echoed<ParametersOne> One(IPayloads p, int one) => new(p.Small, new(one));

    [Get("/parameters/{one}/with-second/{two}")]
    public static Echoed<ParametersTwo> Two(IPayloads p, int one, int two) => new(p.Small, new(one, two));
}

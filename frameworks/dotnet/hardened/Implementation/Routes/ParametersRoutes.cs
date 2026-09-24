using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// parameters: path tokens, each bound by naming a handler parameter after it, as the integer
/// its type says. The routing table tries the literal segment of the static route first.
/// </summary>
public class ParametersRoutes(Payloads payloads)
{
    [Get("/parameters/static/segment/literal")]
    public Payload Static() => payloads.Small;

    [Get("/parameters/{one}/segment/literal")]
    public Echoed<ParametersOne> One(int one) => new(payloads.Small, new(one));

    [Get("/parameters/{one}/with-second/{two}")]
    public Echoed<ParametersTwo> Two(int one, int two) => new(payloads.Small, new(one, two));
}

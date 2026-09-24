using Hardened.Requests.Abstract.Attributes;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// template: [Output&lt;T&gt;] renders what the handler returns through a RazorBlade view, which
/// the build compiles into a C# class.
/// </summary>
public class TemplateRoutes(Payloads payloads)
{
    [Get("/template/small")]
    [Output<Views.ItemsPage>]
    public Payload Small() => payloads.Small;

    [Get("/template/medium")]
    [Output<Views.ItemsPage>]
    public Payload Medium() => payloads.Medium;
}

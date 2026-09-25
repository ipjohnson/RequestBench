using Hardened.Requests.Abstract.Attributes;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// template: [Output&lt;T&gt;] renders the handler's value with a RazorBlade view, which the build
/// compiles from Views/ItemsPage.cshtml.
/// </summary>
public static class TemplateController
{
    [Get("/template/small")]
    [Output<Implementation.Views.ItemsPage>]
    public static Payload Small(IPayloads p) => p.Small;

    [Get("/template/medium")]
    [Output<Implementation.Views.ItemsPage>]
    public static Payload Medium(IPayloads p) => p.Medium;
}

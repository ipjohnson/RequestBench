using FastEndpoints;
using Implementation.Components;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Implementation.Endpoints;

/// <summary>
/// template: FastEndpoints has no view layer of its own, and what ASP.NET Core ships for
/// server-side HTML is Razor. RazorComponentResult renders a component statically, and
/// FastEndpoints sends any IResult through Send.ResultAsync. The Web SDK compiles the component
/// into the assembly at build.
/// </summary>
// rb:handler template.small
public sealed class TemplateSmallEndpoint(Payloads payloads) : EndpointWithoutRequest
{
    public override void Configure() => Get("/template/small");

    public override Task HandleAsync(CancellationToken ct) => Send.ResultAsync(Pages.Of(payloads.Small));
}

// rb:handler template.medium
public sealed class TemplateMediumEndpoint(Payloads payloads) : EndpointWithoutRequest
{
    public override void Configure() => Get("/template/medium");

    public override Task HandleAsync(CancellationToken ct) => Send.ResultAsync(Pages.Of(payloads.Medium));
}

// rb:wiring template.*
internal static class Pages
{
    public static RazorComponentResult<ItemsPage> Of(Payload payload) =>
        new(new Dictionary<string, object?> { [nameof(ItemsPage.Body)] = payload });
}

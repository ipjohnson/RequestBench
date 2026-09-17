using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using RequestBench.Domain;
using RequestBench.FastEndpointsTarget.Components;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// FastEndpoints documents no view story of its own, but it runs on ASP.NET Core, and what
/// ASP.NET Core ships is Razor. RazorComponentResult is how an endpoint outside MVC renders
/// one: it names a component and passes parameters, and the framework renders it
/// statically. The Web SDK compiles the component into the assembly at build, so nothing is
/// parsed per request.
/// </summary>
public abstract class TemplateEndpoint(DomainModel domain, string size) : EndpointWithoutRequest
{
    public override Task HandleAsync(CancellationToken ct) =>
        HttpContext.Response.SendResultAsync(new RazorComponentResult<Items>(
            new Dictionary<string, object?> { ["Body"] = domain.Payload(size) }));
}

public sealed class TemplateSmallEndpoint(DomainModel domain) : TemplateEndpoint(domain, "small")
{
    public override void Configure()
    {
        Get("/template/small");
        AllowAnonymous();
    }
}

public sealed class TemplateMediumEndpoint(DomainModel domain) : TemplateEndpoint(domain, "medium")
{
    public override void Configure()
    {
        Get("/template/medium");
        AllowAnonymous();
    }
}

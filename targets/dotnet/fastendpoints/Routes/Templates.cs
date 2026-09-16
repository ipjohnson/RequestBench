using FastEndpoints;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// The engine is scriban, shared with every other .NET target and named on /__meta.
/// </summary>
public abstract class TemplateEndpoint(DomainModel domain, string size) : EndpointWithoutRequest
{
    public override Task HandleAsync(CancellationToken ct)
    {
        HttpContext.Response.ContentType = "text/html";
        return HttpContext.Response.WriteAsync(Views.RenderItems(domain.Payload(size)), ct);
    }
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

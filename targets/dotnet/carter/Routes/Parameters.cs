using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>parameters: router captures with segment depth held constant.</summary>
public sealed class Parameters : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/parameters/static/segment/literal", (DomainModel d) => d.Payload("small"));

        app.MapGet("/parameters/{one}", (DomainModel d) => d.Payload("small"));

        app.MapGet("/parameters/{one}/with-second/{two}", (DomainModel d) => d.Payload("small"));
    }
}

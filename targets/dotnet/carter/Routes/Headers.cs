using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// headers: eager against lazy construction of the request header map.
///
/// The handler reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 27 nobody asked for.
/// </summary>
public sealed class Headers : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/headers", (DomainModel d) => d.Payload("small"));
    }
}

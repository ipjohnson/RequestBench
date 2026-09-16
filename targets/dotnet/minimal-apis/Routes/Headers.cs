using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// headers: eager against lazy construction of the request header map.
///
/// The handler reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 27 nobody asked for.
/// </summary>
public static class Headers
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/headers", (DomainModel d) => d.Payload("small"));
    }
}

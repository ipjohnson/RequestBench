using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// json: the serializer and response buffering across three size regimes.
///
/// Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
/// router pay parameter cost on the family every other target serves from a static route,
/// and it would answer 200 with an empty body for a size that does not exist.
/// </summary>
public static class JsonRoutes
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/json/small", (DomainModel d) => d.Payload("small"));

        app.MapGet("/json/medium", (DomainModel d) => d.Payload("medium"));

        app.MapGet("/json/large", (DomainModel d) => d.Payload("large"));
    }
}

using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>parameters: router captures with segment depth held constant.</summary>
public static class Parameters
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/parameters/static/segment/literal", (DomainModel d) => d.Payload("small"));

        app.MapGet("/parameters/{one}", (DomainModel d) => d.Payload("small"));

        app.MapGet("/parameters/{one}/with-second/{two}", (DomainModel d) => d.Payload("small"));
    }
}

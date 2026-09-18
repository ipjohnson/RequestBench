using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// parameters: router captures with segment depth held constant, each bound as an integer
/// and echoed.
///
/// A handler parameter named after the capture is the binding, and its type is the
/// conversion the framework runs before the handler does. The static path also matches
/// /parameters/{one}/segment/literal, and routing prefers the literal segment whatever order
/// the two are mapped in.
/// </summary>
public static class Parameters
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/parameters/static/segment/literal", (DomainModel d) => d.Payload("small"));

        app.MapGet("/parameters/{one}/segment/literal",
                   (int one, DomainModel d) => d.WithEcho("small", new { one }));

        app.MapGet("/parameters/{one}/with-second/{two}",
                   (int one, int two, DomainModel d) => d.WithEcho("small", new { one, two }));
    }
}

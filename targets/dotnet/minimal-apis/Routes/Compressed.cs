using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// These routes answer like any other. The response compression middleware that Program.cs
/// installs on the whole application gzips the answer when the request asks for it, at the
/// provider's default level, Fastest, with no minimum size.
/// </summary>
public static class Compressed
{
    // rb:wiring compressed.*
    private static Func<HttpResponse, DomainModel, PayloadBody> Serve(string size) =>
        (response, model) =>
        {
            response.Headers["x-rb-serial"] = model.NextSerial();
            return model.Payload(size);
        };

    public static void Map(WebApplication app)
    {
        app.MapGet("/compressed/small", Serve("small"));

        app.MapGet("/compressed/medium", Serve("medium"));

        app.MapGet("/compressed/large", Serve("large"));
    }
}

using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// An endpoint filter on these three routes alone. ASP.NET's response compression
/// middleware sits on the application, which would put a "did the client ask?" check on all
/// forty-five endpoints and contaminate the rows this family is measured against.
///
/// The codec and the floor are the pinned ones every language shares.
/// </summary>
public sealed class Compressed : ICarterModule
{
    private static async ValueTask<object?> Gzip(EndpointFilterInvocationContext context,
                                                 EndpointFilterDelegate next)
    {
        object? value = await next(context);
        byte[] raw = Json.Bytes(value);
        HttpResponse response = context.HttpContext.Response;
        string accept = context.HttpContext.Request.Headers.AcceptEncoding.ToString();
        if (!accept.Contains("gzip", StringComparison.Ordinal)
            || raw.Length < DomainModel.GzipMinSize)
        {
            return Results.Bytes(raw, "application/json");
        }
        response.Headers.ContentEncoding = "gzip";
        response.Headers.Vary = "Accept-Encoding";
        return Results.Bytes(DomainModel.Gzip(raw), "application/json");
    }

    private static Func<HttpResponse, DomainModel, PayloadBody> Serve(string size) =>
        (response, model) =>
        {
            response.Headers["x-rb-serial"] = model.NextSerial();
            return model.Payload(size);
        };

    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/compressed/small", Serve("small")).AddEndpointFilter(Gzip);

        app.MapGet("/compressed/medium", Serve("medium")).AddEndpointFilter(Gzip);

        app.MapGet("/compressed/large", Serve("large")).AddEndpointFilter(Gzip);
    }
}

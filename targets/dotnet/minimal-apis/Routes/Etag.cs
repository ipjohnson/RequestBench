using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// etag: the framework's own conditional-request machinery, which ASP.NET Core does not
/// have.
///
/// Nothing in it computes a validator for a dynamic response: output caching answers
/// If-None-Match only for a response it already stored, which is what the cache family
/// measures and the opposite of what this one does. So the digest is the shared one in
/// <see cref="Caching.ConditionalGet"/> and the digest is declared in /__meta.
///
/// What is minimal APIs' own is the hook: an endpoint filter on these two routes alone, the
/// same way the compressed family gets its codec without taxing the other forty-six.
/// </summary>
public static class Etag
{
    // rb:wiring etag.*
    private static async ValueTask<object?> Revalidate(EndpointFilterInvocationContext context,
                                                       EndpointFilterDelegate next)
    {
        object? value = await next(context);
        byte[] raw = Json.Bytes(value);
        return Caching.Revalidates(context.HttpContext, raw)
            ? Results.StatusCode(StatusCodes.Status304NotModified)
            : Results.Bytes(raw, "application/json");
    }

    // rb:wiring etag.*
    private static Func<HttpResponse, DomainModel, PayloadBody> Serve(string size) =>
        (response, model) =>
        {
            response.Headers["x-rb-serial"] = model.NextSerial();
            return model.Payload(size);
        };

    public static void Map(WebApplication app)
    {
        // rb:handler etag.*
        app.MapGet("/etag/small", Serve("small")).AddEndpointFilter(Revalidate);

        app.MapGet("/etag/large", Serve("large")).AddEndpointFilter(Revalidate);
    }
}

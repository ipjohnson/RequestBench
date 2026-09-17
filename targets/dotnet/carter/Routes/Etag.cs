using Carter;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// etag: the framework's own conditional-request machinery, which ASP.NET Core does not
/// have. Nothing in it computes a validator for a dynamic response, so the digest is the
/// shared one and /__meta says so.
///
/// Carter maps onto the same IEndpointRouteBuilder minimal APIs do, so the hook is an
/// endpoint filter on these two routes alone rather than middleware in front of the other
/// forty-six.
/// </summary>
public sealed class Etag : ICarterModule
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
    private static Func<HttpContext, DomainModel, PayloadBody> Serve(string size) =>
        (context, model) =>
        {
            context.Response.Headers["x-rb-serial"] = model.NextSerial();
            return model.Payload(size);
        };

    public void AddRoutes(IEndpointRouteBuilder app)
    {
        // rb:handler etag.*
        app.MapGet("/etag/small", Serve("small")).AddEndpointFilter(Revalidate);

        app.MapGet("/etag/large", Serve("large")).AddEndpointFilter(Revalidate);
    }
}

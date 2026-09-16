using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// authorized: the framework's authorization mechanism, crypto excluded.
///
/// An endpoint filter on the one route, not an if in the handler. An if would measure the
/// language; the point of the family is the framework's own plumbing.
/// </summary>
public sealed class Authorized : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/authorized/small", (DomainModel d) => d.Payload("small"))
           .AddEndpointFilter(async (context, next) =>
           {
               DomainModel model = context.HttpContext.RequestServices
                   .GetRequiredService<DomainModel>();
               string? header = context.HttpContext.Request.Headers.Authorization;
               return model.TokenOk(header) ? await next(context) : Results.Problem(statusCode: 403);
           });
    }
}

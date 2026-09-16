using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// authorized: the framework's authorization mechanism, crypto excluded.
///
/// An endpoint filter on the one route, not an if in the handler. An if would measure the
/// language; the point of the family is the framework's own plumbing. ASP.NET's
/// authorization middleware is the fuller answer and would bring a policy evaluation the
/// other forty-four endpoints would also pay for.
/// </summary>
public static class Authorized
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/authorized/small", (DomainModel d) => d.Payload("small"))
           .AddEndpointFilter(async (context, next) =>
           {
               DomainModel model = context.HttpContext.RequestServices
                   .GetRequiredService<DomainModel>();
               string? header = context.HttpContext.Request.Headers.Authorization;
               return model.TokenOk(header)
                   ? await next(context)
                   : Results.Problem(statusCode: 403);
           });
    }
}

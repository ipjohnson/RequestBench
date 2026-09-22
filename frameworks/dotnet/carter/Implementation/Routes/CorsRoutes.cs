using Carter;

namespace Implementation.Routes;

/// <summary>
/// cors: ASP.NET Core's CORS feature, attached to the /cors group and nowhere else. It answers
/// a preflight before any handler runs. The handler writes x-rb-serial, so its absence on a
/// preflight shows the feature answered alone.
/// </summary>
public sealed class CorsRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        RouteGroupBuilder cors = app.MapGroup("/cors").RequireCors(Policies.Cors);

        // rb:handler cors.request
        cors.MapGet("/small", (HttpResponse response, Payloads p) =>
        {
            Serial.Write(response);
            return p.Small;
        });
    }
}

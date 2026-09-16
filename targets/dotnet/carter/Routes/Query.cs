using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// The framework parses request.Query, which is the work this family measures; the domain
/// coerces what it parsed, so every target in the language answers the same values.
/// </summary>
public sealed class Query : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/query/one", (HttpRequest request) =>
            DomainModel.CoerceOne(Support.Query(request)));

        app.MapGet("/query/many", (HttpRequest request) =>
            DomainModel.CoerceMany(Support.Query(request)));
    }
}

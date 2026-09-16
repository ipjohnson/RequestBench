using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// The framework parses request.Query, which is the work this family measures; the domain
/// coerces what it parsed, so every target in the language answers the same values.
/// </summary>
public static class QueryEndpoints
{
    [WolverineGet("/query/one")]
    public static QueryOne One(HttpRequest request) =>
        DomainModel.CoerceOne(Support.Query(request));

    [WolverineGet("/query/many")]
    public static QueryMany Many(HttpRequest request) =>
        DomainModel.CoerceMany(Support.Query(request));
}

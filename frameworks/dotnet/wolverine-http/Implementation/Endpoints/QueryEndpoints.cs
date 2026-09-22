using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// query: query string values. Wolverine binds a parameter of a simple type that no route
/// capture names from the query string value of the same name.
/// </summary>
public static class QueryEndpoints
{
    [WolverineGet("/query/one")]
    public static Echoed<QueryOne> One(int page, Payloads p) => new(p.Small, new(page));

    [WolverineGet("/query/many")]
    public static Echoed<Search> Many(int page, int size, string status, string category, string sort, string q, int minPrice, int maxPrice, Payloads p) =>
        new(p.Small, new(page, size, status, category, sort, q, minPrice, maxPrice));
}

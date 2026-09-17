using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// Minimal APIs bind a query parameter by declaring it on the handler: the name and the
/// type are the binding, and the framework converts what it parsed before the handler runs.
/// [FromQuery(Name = ...)] is only for the two parameters whose name on the wire is not the
/// C# one.
///
/// The parameters are not nullable and carry no default, so the framework decides what a
/// missing or unconvertible one is: its own 400, before the handler. The endpoint set sends
/// neither.
/// </summary>
public static class Query
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/query/one", (int page) => new QueryOne(page));

        app.MapGet("/query/many", (int page, int size, string status, string category,
                                   string sort, string q,
                                   [FromQuery(Name = "min_price")] int minPrice,
                                   [FromQuery(Name = "max_price")] int maxPrice) =>
            new QueryMany(page, size, status, category, sort, q, minPrice, maxPrice));
    }
}

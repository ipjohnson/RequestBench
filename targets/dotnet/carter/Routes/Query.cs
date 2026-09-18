using Carter;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// query: query string parsing, percent-decoding and coercion, with the values echoed and put
/// to no other use.
///
/// A Carter module maps onto the same endpoint builder minimal APIs use, so binding a query
/// parameter is declaring it on the handler: the name and the type are the binding, and the
/// framework converts what it parsed before the handler runs. [FromQuery(Name = ...)] is
/// only for the two parameters whose name on the wire is not the C# one.
///
/// The parameters are not nullable and carry no default, so the framework decides what a
/// missing or unconvertible one is: its own 400, before the handler. The endpoint set sends
/// neither.
/// </summary>
public sealed class Query : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/query/one", (int page, DomainModel d) =>
            d.WithEcho("small", new QueryOne(page)));

        app.MapGet("/query/many", (int page, int size, string status, string category,
                                   string sort, string q,
                                   [FromQuery(Name = "min_price")] int minPrice,
                                   [FromQuery(Name = "max_price")] int maxPrice,
                                   DomainModel d) =>
            d.WithEcho("small",
                       new QueryMany(page, size, status, category, sort, q, minPrice, maxPrice)));
    }
}

using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// Wolverine binds a query parameter by declaring it on the endpoint method: the name and
/// the type are the binding, and it converts what was parsed before the method runs.
/// [FromQuery] is on every one of them rather than left implicit, because Wolverine reads
/// the request body out of the first parameter it does not recognise.
///
/// The parameters are not nullable and carry no default, so what a missing or unconvertible
/// one is stays Wolverine's decision. The endpoint set sends neither.
/// </summary>
public static class QueryEndpoints
{
    [WolverineGet("/query/one")]
    public static QueryOne One([FromQuery] int page) => new(page);

    [WolverineGet("/query/many")]
    public static QueryMany Many([FromQuery] int page, [FromQuery] int size,
                                 [FromQuery] string status, [FromQuery] string category,
                                 [FromQuery] string sort, [FromQuery] string q,
                                 [FromQuery] int min_price, [FromQuery] int max_price) =>
        new(page, size, status, category, sort, q, min_price, max_price);
}

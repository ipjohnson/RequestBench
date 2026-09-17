using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// FastEndpoints binds into a request DTO: an Endpoint&lt;TRequest, TResponse&gt; has the
/// framework fill TRequest from the request before ExecuteAsync runs, and for a GET that is
/// the query string. [BindFrom] is only for the two properties whose name on the wire is not
/// the C# one.
///
/// The properties are not nullable and carry no default, so FastEndpoints decides what a
/// missing or unconvertible one is: its own 400, before the endpoint. The endpoint set sends
/// neither.
/// </summary>
public sealed class QueryOneRequest
{
    public int Page { get; set; }
}

public sealed class QueryManyRequest
{
    public int Page { get; set; }

    public int Size { get; set; }

    public string Status { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Sort { get; set; } = string.Empty;

    public string Q { get; set; } = string.Empty;

    [BindFrom("min_price")]
    public int MinPrice { get; set; }

    [BindFrom("max_price")]
    public int MaxPrice { get; set; }
}

/// <summary>What domain.filter pages by.</summary>
public sealed class OrderFilterRequest
{
    public int Page { get; set; }

    public int Size { get; set; }

    public string Status { get; set; } = string.Empty;
}

// rb:handler query.one
public sealed class QueryOneEndpoint : Endpoint<QueryOneRequest, QueryOne>
{
    public override void Configure()
    {
        Get("/query/one");
        AllowAnonymous();
    }

    public override Task<QueryOne> ExecuteAsync(QueryOneRequest req, CancellationToken ct) =>
        Task.FromResult(new QueryOne(req.Page));
}

// rb:handler query.many
public sealed class QueryManyEndpoint : Endpoint<QueryManyRequest, QueryMany>
{
    public override void Configure()
    {
        Get("/query/many");
        AllowAnonymous();
    }

    public override Task<QueryMany> ExecuteAsync(QueryManyRequest req, CancellationToken ct) =>
        Task.FromResult(new QueryMany(req.Page, req.Size, req.Status, req.Category,
                                      req.Sort, req.Q, req.MinPrice, req.MaxPrice));
}

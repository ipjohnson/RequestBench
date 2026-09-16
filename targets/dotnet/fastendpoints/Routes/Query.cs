using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// The framework parses HttpContext.Request.Query, which is the work this family measures;
/// the domain coerces what it parsed, so every target in the language answers the same
/// values.
/// </summary>
public sealed class QueryOneEndpoint : EndpointWithoutRequest<QueryOne>
{
    public override void Configure()
    {
        Get("/query/one");
        AllowAnonymous();
    }

    public override Task<QueryOne> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(DomainModel.CoerceOne(Support.Query(HttpContext.Request)));
}

public sealed class QueryManyEndpoint : EndpointWithoutRequest<QueryMany>
{
    public override void Configure()
    {
        Get("/query/many");
        AllowAnonymous();
    }

    public override Task<QueryMany> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(DomainModel.CoerceMany(Support.Query(HttpContext.Request)));
}

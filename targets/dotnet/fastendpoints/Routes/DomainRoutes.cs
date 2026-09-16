using FastEndpoints;
using RequestBench.Domain;

// FastEndpoints has an Order of its own, for endpoint ordering.
using Order = RequestBench.Domain.Order;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>domain: application-shaped handler work and the write methods.</summary>
public sealed class DomainFilterEndpoint(DomainModel domain) : EndpointWithoutRequest<OrdersPage>
{
    public override void Configure()
    {
        Get("/domain/orders");
        AllowAnonymous();
    }

    public override Task<OrdersPage> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.DomainFilter(Support.Query(HttpContext.Request)));
}

public sealed class DomainCreateEndpoint(DomainModel domain) : EndpointWithoutRequest<ValidatedOrder>
{
    public override void Configure()
    {
        Post("/domain/orders");
        AllowAnonymous();
    }

    public override async Task<ValidatedOrder> ExecuteAsync(CancellationToken ct)
    {
        ValidatedOrder order = domain.ValidateOrder(await Support.Body(HttpContext.Request, ct));
        HttpContext.Response.Headers.Location = domain.CreatedLocation();
        HttpContext.Response.StatusCode = 201;
        return order;
    }
}

public sealed class DomainLookupEndpoint(DomainModel domain) : EndpointWithoutRequest<Order>
{
    public override void Configure()
    {
        Get("/domain/orders/{oid}");
        AllowAnonymous();
    }

    public override Task<Order> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.GetOrder(Route<string>("oid")!));
}

public sealed class DomainReplaceEndpoint(DomainModel domain) : EndpointWithoutRequest<ValidatedOrder>
{
    public override void Configure()
    {
        Put("/domain/orders/{oid}");
        AllowAnonymous();
    }

    public override async Task<ValidatedOrder> ExecuteAsync(CancellationToken ct)
    {
        Order existing = domain.GetOrder(Route<string>("oid")!);
        ValidatedOrder order = domain.ValidateOrder(await Support.Body(HttpContext.Request, ct));
        return order with { Id = existing.Id };
    }
}

public sealed class DomainJoinEndpoint(DomainModel domain) : EndpointWithoutRequest<JoinSummary>
{
    public override void Configure()
    {
        Get("/domain/customers/{cid}/summary");
        AllowAnonymous();
    }

    public override Task<JoinSummary> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.DomainJoin(Route<string>("cid")!));
}

public sealed class DomainAggregateEndpoint(DomainModel domain) : EndpointWithoutRequest<Report>
{
    public override void Configure()
    {
        Get("/domain/regions/{region}/report");
        AllowAnonymous();
    }

    public override Task<Report> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.DomainAggregate(Route<string>("region")!));
}

public sealed class DomainPatchEndpoint(DomainModel domain) : EndpointWithoutRequest<Customer>
{
    public override void Configure()
    {
        Patch("/domain/customers/{cid}");
        AllowAnonymous();
    }

    public override async Task<Customer> ExecuteAsync(CancellationToken ct) =>
        domain.PatchCustomer(Route<string>("cid")!, await Support.Body(HttpContext.Request, ct));
}

public sealed class DomainDeleteEndpoint(DomainModel domain) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Delete("/domain/orders/{oid}/lines/{lid}");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        domain.GetOrderLine(Route<string>("oid")!, Route<string>("lid")!);
        return HttpContext.Response.SendNoContentAsync(ct);
    }
}

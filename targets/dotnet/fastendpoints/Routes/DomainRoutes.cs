using FastEndpoints;
using RequestBench.Domain;

// FastEndpoints has an Order of its own, for endpoint ordering.
using Order = RequestBench.Domain.Order;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>domain: application-shaped handler work and the write methods.</summary>
// rb:handler domain.filter
public sealed class DomainFilterEndpoint(DomainModel domain)
    : Endpoint<OrderFilterRequest, OrdersPage>
{
    public override void Configure()
    {
        Get("/domain/orders");
        AllowAnonymous();
    }

    public override Task<OrdersPage> ExecuteAsync(OrderFilterRequest req, CancellationToken ct) =>
        Task.FromResult(domain.DomainFilter(req.Page, req.Size, req.Status));
}

// rb:handler domain.create
public sealed class DomainCreateEndpoint(DomainModel domain) : Endpoint<OrderRequest, ValidatedOrder>
{
    public override void Configure()
    {
        Post("/domain/orders");
        AllowAnonymous();
    }

    public override Task<ValidatedOrder> ExecuteAsync(OrderRequest req, CancellationToken ct)
    {
        ValidatedOrder order = domain.PriceOrder(req.CustomerId!.Value, req.Status!, req.Input());
        HttpContext.Response.Headers.Location = domain.CreatedLocation();
        HttpContext.Response.StatusCode = 201;
        return Task.FromResult(order);
    }
}

// rb:handler domain.lookup,errors.not_found
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

// rb:handler domain.replace
public sealed class DomainReplaceEndpoint(DomainModel domain) : Endpoint<OrderRequest, ValidatedOrder>
{
    public override void Configure()
    {
        Put("/domain/orders/{oid}");
        AllowAnonymous();
    }

    public override Task<ValidatedOrder> ExecuteAsync(OrderRequest req, CancellationToken ct)
    {
        Order existing = domain.GetOrder(Route<string>("oid")!);
        ValidatedOrder order = domain.PriceOrder(req.CustomerId!.Value, req.Status!, req.Input());
        return Task.FromResult(order with { Id = existing.Id });
    }
}

// rb:handler domain.join
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

// rb:handler domain.aggregate
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

// rb:handler domain.patch
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

// rb:handler domain.delete
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

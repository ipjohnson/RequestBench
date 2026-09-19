using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// domain: application-shaped handler work and the write methods.
///
/// Services are marked [FromServices] on every write method. Wolverine reads the request
/// body out of the first parameter it does not recognise, and an endpoint that advertises a
/// body on a method that cannot carry one is dropped from route matching and answers a bare
/// 404 with nothing logged.
/// </summary>
public static class DomainEndpoints
{
    [WolverineGet("/domain/orders")]
    public static OrdersPage Filter([FromQuery] int page, [FromQuery] int size,
                                    [FromQuery] string status,
                                    [FromServices] DomainModel domain) =>
        domain.DomainFilter(page, size, status);

    [WolverinePost("/domain/orders")]
    public static IResult Create(OrderBody body, [FromServices] DomainModel domain,
                                 [FromServices] IHttpContextAccessor accessor)
    {
        ValidatedOrder order =
            domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
        accessor.HttpContext!.Response.Headers.Location = domain.CreatedLocation();
        return Results.Json(order, statusCode: 201);
    }

    [WolverineGet("/domain/orders/{oid}")]
    public static Order Lookup(string oid, DomainModel domain) => domain.GetOrder(oid);

    [WolverinePut("/domain/orders/{oid}")]
    public static ValidatedOrder Replace(string oid, OrderBody body,
                                         [FromServices] DomainModel domain)
    {
        Order existing = domain.GetOrder(oid);
        return domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input())
            with { Id = existing.Id };
    }

    [WolverineGet("/domain/customers/{cid}/summary")]
    public static JoinSummary Summary(string cid, DomainModel domain) => domain.DomainJoin(cid);

    [WolverineGet("/domain/regions/{region}/report")]
    public static Report RegionReport(string region, DomainModel domain) =>
        domain.DomainAggregate(region);

    [WolverinePatch("/domain/customers/{cid}")]
    public static Customer Patch(string cid, JsonElement body,
                                 [FromServices] DomainModel domain) =>
        domain.PatchCustomer(cid, body);

    [WolverineDelete("/domain/orders/{oid}/lines/{lid}")]
    public static IResult Delete(string oid, string lid, [FromServices] DomainModel domain)
    {
        domain.GetOrderLine(oid, lid);
        return Results.NoContent();
    }
}

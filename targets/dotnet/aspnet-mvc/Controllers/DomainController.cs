using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>domain: application-shaped handler work and the write methods.</summary>
[ApiController]
public sealed class DomainController(DomainModel domain) : ControllerBase
{
    [HttpGet("/domain/orders")]
    public OrdersPage Filter() => domain.DomainFilter(Support.Query(Request));

    [HttpPost("/domain/orders")]
    public IActionResult Create([FromBody] OrderIn body)
    {
        ValidatedOrder order = domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
        Response.Headers.Location = domain.CreatedLocation();
        return StatusCode(201, order);
    }

    [HttpGet("/domain/orders/{oid}")]
    public Order Lookup(string oid) => domain.GetOrder(oid);

    [HttpPut("/domain/orders/{oid}")]
    public ValidatedOrder Replace(string oid, [FromBody] OrderIn body)
    {
        Order existing = domain.GetOrder(oid);
        return domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input())
            with { Id = existing.Id };
    }

    [HttpGet("/domain/customers/{cid}/summary")]
    public JoinSummary Summary(string cid) => domain.DomainJoin(cid);

    [HttpGet("/domain/regions/{region}/report")]
    public Report RegionReport(string region) => domain.DomainAggregate(region);

    [HttpPatch("/domain/customers/{cid}")]
    public Customer Patch(string cid, [FromBody] JsonElement body) =>
        domain.PatchCustomer(cid, body);

    [HttpDelete("/domain/orders/{oid}/lines/{lid}")]
    public IActionResult Delete(string oid, string lid)
    {
        domain.GetOrderLine(oid, lid);
        return NoContent();
    }
}

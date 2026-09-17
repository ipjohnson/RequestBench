using System.Text.Json;
using FluentValidation;
using Carter;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>domain: application-shaped handler work and the write methods.</summary>
public sealed class DomainRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/domain/orders", (int page, int size, string status, DomainModel d) =>
            d.DomainFilter(page, size, status));

        app.MapPost("/domain/orders", (OrderBody body, DomainModel d, IValidator<OrderBody> v,
                                      HttpResponse response) =>
        {
            if (Body.Refused(v, body) is IResult refused)
            {
                return refused;
            }
            ValidatedOrder order = d.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
            response.Headers.Location = d.CreatedLocation();
            return Results.Json(order, statusCode: 201);
        });

        app.MapGet("/domain/orders/{oid}", (string oid, DomainModel d) => d.GetOrder(oid));

        app.MapPut("/domain/orders/{oid}", (string oid, OrderBody body, DomainModel d,
                                           IValidator<OrderBody> v) =>
        {
            Order existing = d.GetOrder(oid);
            if (Body.Refused(v, body) is IResult refused)
            {
                return refused;
            }
            return Results.Ok(d.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input())
                with { Id = existing.Id });
        });

        app.MapGet("/domain/customers/{cid}/summary", (string cid, DomainModel d) => d.DomainJoin(cid));

        app.MapGet("/domain/regions/{region}/report",
                   (string region, DomainModel d) => d.DomainAggregate(region));

        app.MapPatch("/domain/customers/{cid}",
                     (string cid, JsonElement body, DomainModel d) => d.PatchCustomer(cid, body));

        app.MapDelete("/domain/orders/{oid}/lines/{lid}", (string oid, string lid, DomainModel d) =>
        {
            d.GetOrderLine(oid, lid);
            return Results.NoContent();
        });
    }
}

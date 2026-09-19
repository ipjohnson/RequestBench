using System.Text.Json;
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

        // Carter's MapPost<T> and MapPut<T> validate the body in Carter's endpoint filter, the
        // same as the body routes, so a refused body never reaches either handler.
        app.MapPost<OrderBody>("/domain/orders", (OrderBody body, DomainModel d,
                                                  HttpResponse response) =>
        {
            ValidatedOrder order = Body.Priced(d, body);
            response.Headers.Location = d.CreatedLocation();
            return Results.Json(order, statusCode: 201);
        });

        app.MapGet("/domain/orders/{oid}", (string oid, DomainModel d) => d.GetOrder(oid));

        app.MapPut<OrderBody>("/domain/orders/{oid}", (string oid, OrderBody body, DomainModel d) =>
        {
            Order existing = d.GetOrder(oid);
            return Results.Ok(Body.Priced(d, body) with { Id = existing.Id });
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

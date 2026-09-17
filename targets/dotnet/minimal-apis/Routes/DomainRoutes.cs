using System.Text.Json;
using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>domain: application-shaped handler work and the write methods.</summary>
public static class DomainRoutes
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/domain/orders", (HttpRequest request, DomainModel d) =>
            d.DomainFilter(Support.Query(request)));

        app.MapPost("/domain/orders", (OrderIn body, DomainModel d, HttpResponse response) =>
        {
            ValidatedOrder order = Body.Priced(d, body);
            response.Headers.Location = d.CreatedLocation();
            return Results.Json(order, statusCode: 201);
        });

        app.MapGet("/domain/orders/{oid}", (string oid, DomainModel d) => d.GetOrder(oid));

        app.MapPut("/domain/orders/{oid}", (string oid, OrderIn body, DomainModel d) =>
        {
            Order existing = d.GetOrder(oid);
            return Body.Priced(d, body) with { Id = existing.Id };
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

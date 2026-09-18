using Carter;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// headers: the request header map at five and at thirty headers, left unread and with three
/// of them bound and echoed.
///
/// /headers reads no header at all, so headers.many minus headers.few is the cost of 25 more
/// headers that nobody asked for. A Carter module maps onto the same endpoint builder minimal
/// APIs use, so /headers/bind binds three by declaring them on the handler: [FromHeader]
/// names the header, and the parameter's type is the conversion the framework runs before
/// the handler does.
///
/// The parameters are not nullable and carry no default, so the framework decides what a
/// missing or unconvertible one is. The endpoint set sends neither.
/// </summary>
public sealed class Headers : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/headers", (DomainModel d) => d.Payload("small"));

        app.MapGet("/headers/bind", ([FromHeader(Name = "x-rb-tenant")] string tenant,
                                     [FromHeader(Name = "x-rb-request-id")] string requestId,
                                     [FromHeader(Name = "x-rb-account")] int account,
                                     DomainModel d) =>
            d.WithEcho("small", new { tenant, requestId, account }));
    }
}

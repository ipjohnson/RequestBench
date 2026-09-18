using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// headers: the request header map at five and at thirty headers, left unread and with three
/// of them bound and echoed.
///
/// The Headers action reads no header at all, so headers.many minus headers.few is the cost
/// of 25 more headers that nobody asked for. Bind is MVC's own model binding: [FromHeader]
/// names the header and the action signature declares the type, and the binder converts the
/// value before the action runs.
///
/// [ApiController] is on the class, so a value the binder cannot convert is answered by MVC's
/// own automatic 400, not by anything here. The endpoint set sends neither that nor a missing
/// header.
/// </summary>
[ApiController]
public sealed class HeadersController(DomainModel domain) : ControllerBase
{
    [HttpGet("/headers")]
    public PayloadBody Headers() => domain.Payload("small");

    [HttpGet("/headers/bind")]
    public PayloadWithEcho Bind([FromHeader(Name = "x-rb-tenant")] string tenant,
                                [FromHeader(Name = "x-rb-request-id")] string requestId,
                                [FromHeader(Name = "x-rb-account")] int account) =>
        domain.WithEcho("small", new { tenant, requestId, account });
}

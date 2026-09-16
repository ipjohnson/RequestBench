using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// headers: eager against lazy construction of the request header map.
///
/// The action reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 27 nobody asked for.
/// </summary>
[ApiController]
public sealed class HeadersController(DomainModel domain) : ControllerBase
{
    [HttpGet("/headers")]
    public PayloadBody Headers() => domain.Payload("small");
}

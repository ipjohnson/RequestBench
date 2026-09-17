using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// etag: the framework's own conditional-request machinery, which ASP.NET Core does not
/// have. Nothing in it computes a validator for a dynamic response, so the digest is the
/// shared one and /__meta says so.
///
/// What is MVC's own is the hook: a result filter attribute on this controller alone, which
/// is how MVC scopes behaviour to an action without a middleware in front of every other
/// one. The filter runs around the result's execution, so it sees the bytes the formatter
/// wrote and hashes those rather than the object above them.
/// </summary>
// rb:wiring etag.*
public sealed class RevalidateAttribute : Attribute, IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context,
                                             ResultExecutionDelegate next)
    {
        await Caching.ConditionalGet(context.HttpContext, async () => await next());
    }
}

[ApiController]
[Revalidate]
public sealed class EtagController(DomainModel domain) : ControllerBase
{
    // rb:wiring etag.*
    private IActionResult Serve(string size)
    {
        Response.Headers["x-rb-serial"] = domain.NextSerial();
        return Ok(domain.Payload(size));
    }

    // rb:handler etag.*
    [HttpGet("/etag/small")]
    public IActionResult Small() => Serve("small");

    [HttpGet("/etag/large")]
    public IActionResult Large() => Serve("large");
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// authorized: the framework's authorization mechanism, crypto excluded.
///
/// An action filter on the one action, not an if in the action. An if would measure the
/// language; the point of the family is the framework's own plumbing. ASP.NET's
/// authorization filters are the fuller answer and would bring a policy evaluation the
/// other forty-four endpoints would also pay for.
/// </summary>
public sealed class RequireTokenAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context,
                                             ActionExecutionDelegate next)
    {
        DomainModel domain = context.HttpContext.RequestServices.GetRequiredService<DomainModel>();
        string? header = context.HttpContext.Request.Headers.Authorization;
        if (!domain.TokenOk(header))
        {
            context.Result = new ObjectResult(new ProblemDetails { Status = 403 })
            {
                StatusCode = 403,
            };
            return;
        }
        await next();
    }
}

[ApiController]
public sealed class AuthorizedController(DomainModel domain) : ControllerBase
{
    [HttpGet("/authorized/small")]
    [RequireToken]
    public PayloadBody Small() => domain.Payload("small");
}

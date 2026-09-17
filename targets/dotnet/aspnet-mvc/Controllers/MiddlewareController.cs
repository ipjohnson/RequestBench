using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
///
/// An action filter is MVC's own per-action layer, which is the scoping the family needs.
/// Middleware added to the application would run on all forty-five endpoints. Each layer
/// calls the next and does nothing else.
///
/// The counts are written out because an attribute is resolved at compile time and there is
/// nothing to loop over. MVC runs one filter instance per attribute, so four attributes are
/// four layers.
/// </summary>
// AllowMultiple, because a layer count is the number of times the attribute is
// applied and the compiler refuses a repeat without it.
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
// rb:wiring middleware.*
public sealed class NoopFilterAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context,
                                             ActionExecutionDelegate next) => await next();
}

[ApiController]
public sealed class MiddlewareController(DomainModel domain) : ControllerBase
{
    [HttpGet("/middleware/none")]
    public PayloadBody None() => domain.Payload("small");

    [HttpGet("/middleware/four")]
    [NoopFilter, NoopFilter, NoopFilter, NoopFilter]
    public PayloadBody Four() => domain.Payload("small");

    [HttpGet("/middleware/sixteen")]
    [NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter]
    [NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter, NoopFilter]
    public PayloadBody Sixteen() => domain.Payload("small");
}

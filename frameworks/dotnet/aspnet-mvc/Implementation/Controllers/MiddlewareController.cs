using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Implementation.Controllers;

/// <summary>
/// middleware: no-op layers in front of the action. An action filter is MVC's per-action
/// layer. Middleware added to the application would run on every route rather than on these
/// two.
/// </summary>
[ApiController]
public sealed class MiddlewareController(Payloads payloads) : ControllerBase
{
    [HttpGet("/middleware/none")]
    public Payload None() => payloads.Small;

    [HttpGet("/middleware/four")]
    [Noop, Noop, Noop, Noop]
    public Payload Four() => payloads.Small;

    [HttpGet("/middleware/sixteen")]
    [Noop, Noop, Noop, Noop, Noop, Noop, Noop, Noop]
    [Noop, Noop, Noop, Noop, Noop, Noop, Noop, Noop]
    public Payload Sixteen() => payloads.Small;
}

// rb:wiring middleware.*
/// <summary>
/// One layer that calls the next and does nothing else. MVC runs one filter per attribute it
/// finds, so a route has as many layers as it has attributes, and AllowMultiple is what lets
/// the compiler take a repeat.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
public sealed class NoopAttribute : Attribute, IAsyncActionFilter
{
    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next) => next();
}

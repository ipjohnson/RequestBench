using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// sse: items.medium's rows as server-sent events. MVC has no result for them, and runs an
/// IResult an action returns, so the action returns ASP.NET Core 10's own, which serialises each
/// row with the minimal API JSON options and flushes it as one event.
/// </summary>
[ApiController]
public sealed class SseController(Payloads payloads) : ControllerBase
{
    [HttpGet("/sse/medium")]
    public ServerSentEventsResult<Item> Medium() => TypedResults.ServerSentEvents(payloads.Medium.Items.ToAsyncEnumerable());
}

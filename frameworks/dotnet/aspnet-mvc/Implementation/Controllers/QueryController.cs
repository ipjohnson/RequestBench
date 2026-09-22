using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// query: query string values bound by MVC's model binding. The one value is an action
/// parameter, and the eight are one model, bound through its constructor by name.
/// </summary>
[ApiController]
public sealed class QueryController(Payloads payloads) : ControllerBase
{
    [HttpGet("/query/one")]
    public Echoed<QueryOne> One(int page) => new(payloads.Small, new(page));

    [HttpGet("/query/many")]
    public Echoed<Search> Many([FromQuery] Search search) => new(payloads.Small, search);
}

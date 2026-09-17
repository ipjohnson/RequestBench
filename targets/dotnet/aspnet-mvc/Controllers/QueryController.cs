using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// MVC's own model binding: [FromQuery] names the source and the action signature declares
/// the type, and the binder converts what the router parsed before the action runs. A Name
/// is given only for the two parameters whose name on the wire is not the C# one.
///
/// [ApiController] is on the class, so a value the binder cannot convert is answered by
/// MVC's own automatic 400 with a ValidationProblemDetails body, not by anything here. The
/// endpoint set sends neither that nor a missing parameter.
/// </summary>
[ApiController]
public sealed class QueryController : ControllerBase
{
    [HttpGet("/query/one")]
    public QueryOne One([FromQuery] int page) => new(page);

    [HttpGet("/query/many")]
    public QueryMany Many([FromQuery] int page, [FromQuery] int size,
                          [FromQuery] string status, [FromQuery] string category,
                          [FromQuery] string sort, [FromQuery] string q,
                          [FromQuery(Name = "min_price")] int minPrice,
                          [FromQuery(Name = "max_price")] int maxPrice) =>
        new(page, size, status, category, sort, q, minPrice, maxPrice);
}

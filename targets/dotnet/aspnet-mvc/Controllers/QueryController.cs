using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// query: query string parsing, percent-decoding and coercion, with the values echoed and put
/// to no other use.
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
public sealed class QueryController(DomainModel domain) : ControllerBase
{
    [HttpGet("/query/one")]
    public PayloadWithEcho One([FromQuery] int page) =>
        domain.WithEcho("small", new QueryOne(page));

    [HttpGet("/query/many")]
    public PayloadWithEcho Many([FromQuery] int page, [FromQuery] int size,
                                [FromQuery] string status, [FromQuery] string category,
                                [FromQuery] string sort, [FromQuery] string q,
                                [FromQuery(Name = "min_price")] int minPrice,
                                [FromQuery(Name = "max_price")] int maxPrice) =>
        domain.WithEcho("small",
                        new QueryMany(page, size, status, category, sort, q, minPrice, maxPrice));
}

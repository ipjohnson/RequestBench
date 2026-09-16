using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// query: query string parsing and coercion, isolated from any use of the values.
///
/// The framework parses Request.Query, which is the work this family measures; the domain
/// coerces what it parsed, so every target in the language answers the same values.
/// </summary>
[ApiController]
public sealed class QueryController : ControllerBase
{
    [HttpGet("/query/one")]
    public QueryOne One() => DomainModel.CoerceOne(Support.Query(Request));

    [HttpGet("/query/many")]
    public QueryMany Many() => DomainModel.CoerceMany(Support.Query(Request));
}

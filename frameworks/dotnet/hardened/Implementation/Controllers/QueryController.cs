using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// query: query string values bound by [FromQueryString]. query.many binds all eight into one
/// model, one value per member.
/// </summary>
public static class QueryController
{
    [Get("/query/one")]
    public static Echoed<QueryOne> One(IPayloads p, [FromQueryString] int page) => new(p.Small, new(page));

    [Get("/query/many")]
    public static Echoed<Search> Many(IPayloads p, [FromQueryString] Search search) => new(p.Small, search);
}

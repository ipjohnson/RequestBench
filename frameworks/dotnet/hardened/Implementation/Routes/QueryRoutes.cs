using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// query: query string values, one bound by its parameter and eight bound as a model, one value
/// per member.
/// </summary>
public class QueryRoutes(Payloads payloads)
{
    [Get("/query/one")]
    public Echoed<QueryOne> One([FromQueryString] int page) => new(payloads.Small, new(page));

    [Get("/query/many")]
    public Echoed<Search> Many([FromQueryString] Search search) => new(payloads.Small, search);
}

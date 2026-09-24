using Hardened.Requests.Abstract.Attributes;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// baseline: the dispatch floor, with nothing serialised. A handler that returns a string and
/// declares one media type is written as the string, unchanged.
/// </summary>
public class BaselineRoutes
{
    [Get("/plaintext")]
    [Produces("text/plain")]
    public string Plaintext() => "Hello, World!";
}

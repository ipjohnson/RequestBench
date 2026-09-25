using Hardened.Requests.Abstract.Attributes;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>baseline: the dispatch floor, with nothing serialised.</summary>
public static class BaselineController
{
    /// <remarks>A string under a declared media type is written unchanged.</remarks>
    [Get("/plaintext")]
    [Produces("text/plain")]
    public static string Plaintext() => "Hello, World!";
}

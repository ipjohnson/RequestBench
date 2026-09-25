using Hardened.Requests.Abstract.Forms;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>forms: bodies bound by Hardened's form binding, which [FromForm] selects.</summary>
public static class FormsController
{
    /// <remarks>The eight fields bound into one model, one field per member, as query.many binds them.</remarks>
    [Post("/forms/urlencoded")]
    public static Echoed<Search> Urlencoded(IPayloads p, [FromForm] Search search) => new(p.Small, search);

    [Post("/forms/multipart")]
    public static Uploaded Multipart([FromForm] string tenant, [FromForm] string requestId, [FromForm] IFormFile file) =>
        new(new(file.FileName, file.Length), new(tenant, requestId));
}

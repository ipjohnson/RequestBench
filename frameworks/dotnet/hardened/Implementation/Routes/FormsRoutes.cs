using Hardened.Requests.Abstract.Forms;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// forms: bodies bound by Hardened's form binding. The urlencoded row binds query.many's model
/// from the form's fields, and the multipart row binds two fields and the file.
/// </summary>
public class FormsRoutes(Payloads payloads)
{
    [Post("/forms/urlencoded")]
    public Echoed<Search> Urlencoded([FromForm] Search search) => new(payloads.Small, search);

    [Post("/forms/multipart")]
    public Uploaded Multipart([FromForm] string tenant, [FromForm] string requestId, [FromForm] IFormFile file) =>
        new(new(file.FileName, file.Length), new(tenant, requestId));
}

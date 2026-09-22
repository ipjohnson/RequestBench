using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// forms: bodies bound by MVC's form binding. The urlencoded form binds to the model query.many
/// binds, and the upload binds two fields and the file by name.
/// </summary>
[ApiController]
public sealed class FormsController(Payloads payloads) : ControllerBase
{
    [HttpPost("/forms/urlencoded")]
    public Echoed<Search> Urlencoded([FromForm] Search search) => new(payloads.Small, search);

    [HttpPost("/forms/multipart")]
    public Uploaded Multipart([FromForm] string tenant, [FromForm] string requestId, IFormFile file) =>
        new(new(file.FileName, file.Length), new(tenant, requestId));
}

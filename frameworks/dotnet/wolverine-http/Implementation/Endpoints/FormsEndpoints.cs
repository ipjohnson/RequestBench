using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// forms: bodies bound by Wolverine's form binding, a [FromForm] parameter or an IFormFile.
/// Wolverine requires an antiforgery token on an endpoint that binds a form, and the corpus is
/// not a browser session, so both routes opt out with Wolverine's [DisableAntiforgery].
/// </summary>
public static class FormsEndpoints
{
    [WolverinePost("/forms/urlencoded")]
    [DisableAntiforgery]
    public static Echoed<Search> Urlencoded([FromForm] int page, [FromForm] int size, [FromForm] string status, [FromForm] string category,
                                            [FromForm] string sort, [FromForm] string q, [FromForm] int minPrice, [FromForm] int maxPrice,
                                            [FromServices] Payloads p) =>
        new(p.Small, new(page, size, status, category, sort, q, minPrice, maxPrice));

    [WolverinePost("/forms/multipart")]
    [DisableAntiforgery]
    public static Uploaded Multipart([FromForm] string tenant, [FromForm] string requestId, IFormFile file) =>
        new(new(file.FileName, file.Length), new(tenant, requestId));
}

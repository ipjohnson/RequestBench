using Microsoft.AspNetCore.Mvc;

namespace Implementation.Routes;

/// <summary>
/// forms: bodies bound by minimal APIs' form binding. A route that binds a form requires an
/// antiforgery token by default, and the corpus is not a browser session, so both routes
/// turn that off.
/// </summary>
public static class FormsRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/forms/urlencoded", ([FromForm] int page, [FromForm] int size, [FromForm] string status, [FromForm] string category,
                                          [FromForm] string sort, [FromForm] string q, [FromForm] int minPrice, [FromForm] int maxPrice,
                                          Payloads p) =>
            new Echoed<Search>(p.Small, new(page, size, status, category, sort, q, minPrice, maxPrice)))
           .DisableAntiforgery();

        app.MapPost("/forms/multipart", ([FromForm] string tenant, [FromForm] string requestId, IFormFile file) =>
            new Uploaded(new(file.FileName, file.Length), new(tenant, requestId)))
           .DisableAntiforgery();
    }
}

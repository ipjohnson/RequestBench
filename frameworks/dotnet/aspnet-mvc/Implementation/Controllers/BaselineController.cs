using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>baseline: the dispatch floor, with nothing serialised.</summary>
[ApiController]
public sealed class BaselineController : ControllerBase
{
    [HttpGet("/plaintext")]
    public ContentResult Plaintext() => Content("Hello, World!", "text/plain");
}

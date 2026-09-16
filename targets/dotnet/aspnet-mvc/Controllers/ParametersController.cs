using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>parameters: router captures with segment depth held constant.</summary>
[ApiController]
public sealed class ParametersController(DomainModel domain) : ControllerBase
{
    [HttpGet("/parameters/static/segment/literal")]
    public PayloadBody StaticPath() => domain.Payload("small");

    [HttpGet("/parameters/{one}")]
    public PayloadBody One(string one) => domain.Payload("small");

    [HttpGet("/parameters/{one}/with-second/{two}")]
    public PayloadBody Two(string one, string two) => domain.Payload("small");
}

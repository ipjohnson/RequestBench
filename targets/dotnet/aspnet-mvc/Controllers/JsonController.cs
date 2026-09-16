using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// json: the serializer and response buffering across three size regimes.
///
/// Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
/// router pay parameter cost on the family every other target serves from a static route.
/// </summary>
[ApiController]
public sealed class JsonController(DomainModel domain) : ControllerBase
{
    [HttpGet("/json/small")]
    public PayloadBody Small() => domain.Payload("small");

    [HttpGet("/json/medium")]
    public PayloadBody Medium() => domain.Payload("medium");

    [HttpGet("/json/large")]
    public PayloadBody Large() => domain.Payload("large");
}

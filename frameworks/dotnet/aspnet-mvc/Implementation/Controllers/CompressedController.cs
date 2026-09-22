using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// compressed: these actions answer like any other. ASP.NET Core's response compression,
/// installed on the whole application, gzips the answer when the request asks for it.
/// </summary>
[ApiController]
public sealed class CompressedController(Payloads payloads) : ControllerBase
{
    [HttpGet("/compressed/small")]
    public Payload Small() => Fresh(payloads.Small);

    [HttpGet("/compressed/large")]
    public Payload Large() => Fresh(payloads.Large);

    private Payload Fresh(Payload payload)
    {
        Serial.Write(Response);
        return payload;
    }
}

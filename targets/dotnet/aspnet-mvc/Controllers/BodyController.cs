using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// body: the parser and the validator, with size crossed against validation.
///
/// MVC binds the request body, so a body it cannot read fails inside the framework rather
/// than in the domain; the InvalidModelStateResponseFactory in Program turns that into the
/// shared 422.
///
/// bind parses and binds without validating, so validate minus bind is the validator alone
/// rather than the validator plus the parse.
/// </summary>
[ApiController]
public sealed class BodyController(DomainModel domain) : ControllerBase
{
    [HttpPost("/body/bind/small")]
    public BindResult BindSmall([FromBody] JsonElement body) => DomainModel.BindEcho(body);

    [HttpPost("/body/bind/medium")]
    public BindResult BindMedium([FromBody] JsonElement body) => DomainModel.BindEcho(body);

    [HttpPost("/body/validate/small")]
    public ValidatedOrder ValidateSmall([FromBody] JsonElement body) => domain.ValidateOrder(body);

    [HttpPost("/body/validate/medium")]
    public ValidatedOrder ValidateMedium([FromBody] JsonElement body) => domain.ValidateOrder(body);

    [HttpPost("/body/validate/first-error")]
    public ValidatedOrder ValidateFirst([FromBody] JsonElement body) =>
        domain.ValidateOrder(body, firstError: true);
}

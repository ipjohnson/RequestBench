using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// body: the parser and the validator, with size crossed against validation.
///
/// MVC binds the request body, so a body it cannot read fails inside the framework rather
/// than in a handler.
///
/// bind parses and binds without validating, so validate minus bind is the validator alone
/// rather than the validator plus the parse. Validating is MVC's own: [ApiController] makes
/// it check ModelState against the DataAnnotations on OrderIn before the action is entered,
/// and answer InvalidModelStateResponseFactory's ProblemDetails itself when it fails. No
/// action calls a validator.
/// </summary>
[ApiController]
public sealed class BodyController(DomainModel domain) : ControllerBase
{
    [HttpPost("/body/bind/small")]
    public BindResult BindSmall([FromBody] JsonElement body) => DomainModel.BindEcho(body);

    [HttpPost("/body/bind/medium")]
    public BindResult BindMedium([FromBody] JsonElement body) => DomainModel.BindEcho(body);

    [HttpPost("/body/validate/small")]
    public ValidatedOrder ValidateSmall([FromBody] OrderIn body) =>
        domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());

    [HttpPost("/body/validate/medium")]
    public ValidatedOrder ValidateMedium([FromBody] OrderIn body) =>
        domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());

    // DataAnnotations reports every attribute that failed and has no mode that stops at the
    // first, so this row answers what MVC answers. The gap to body.rejected_all is what MVC
    // costs rather than the same walk written twice.
    [HttpPost("/body/validate/first-error")]
    public ValidatedOrder ValidateFirst([FromBody] OrderIn body) =>
        domain.PriceOrder(body.CustomerId!.Value, body.Status!, body.Input());
}

using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// forms: bodies bound by FastEndpoints' form binding, which an endpoint enables for itself.
/// FastEndpoints checks an antiforgery token only on an endpoint that asks for one, so these
/// two need nothing turned off.
/// </summary>
// rb:handler forms.urlencoded
public sealed class FormsUrlencodedEndpoint(Payloads payloads) : Endpoint<Search, Echoed<Search>>
{
    public override void Configure()
    {
        Post("/forms/urlencoded");
        AllowFormData(urlEncoded: true);
    }

    public override Task HandleAsync(Search req, CancellationToken ct) => Send.OkAsync(new(payloads.Small, req), ct);
}

// rb:handler forms.multipart
public sealed class FormsMultipartEndpoint : Endpoint<Upload, Uploaded>
{
    public override void Configure()
    {
        Post("/forms/multipart");
        AllowFileUploads();
    }

    public override Task HandleAsync(Upload req, CancellationToken ct) =>
        Send.OkAsync(new(new(req.File.FileName, req.File.Length), new(req.Tenant, req.RequestId)), ct);
}

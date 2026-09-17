using System.Text.Json;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget;

/// <summary>What more than one endpoint needs.</summary>
public static class Support
{
    /// <summary>
    /// The request body as a value. FastEndpoints binds a request DTO, and the endpoint set
    /// needs the raw document so the validator can produce the exact field errors every
    /// other target produces; the read is still the framework's.
    /// </summary>
    public static async ValueTask<JsonElement> Body(HttpRequest request, CancellationToken ct)
    {
        try
        {
            return await request.ReadFromJsonAsync<JsonElement>(Json.Options, ct);
        }
        catch (JsonException e)
        {
            throw new MalformedException(e.Message);
        }
    }
}

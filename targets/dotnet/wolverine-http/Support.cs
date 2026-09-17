using System.Text.Json;
using RequestBench.Domain;

namespace RequestBench.WolverineTarget;

/// <summary>What more than one endpoint needs.</summary>
public static class Support
{
    /// <summary>
    /// The request body as a value. Wolverine binds a declared request type, and the
    /// endpoint set needs the raw document so the validator can produce the exact field
    /// errors every other target produces; the read is still the framework's.
    /// </summary>
    public static async ValueTask<JsonElement> Body(HttpRequest request)
    {
        try
        {
            return await request.ReadFromJsonAsync<JsonElement>(Json.Options);
        }
        catch (JsonException e)
        {
            throw new MalformedException(e.Message);
        }
    }
}

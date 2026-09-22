using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>baseline: the dispatch floor, with nothing serialised. Wolverine writes a returned string as text/plain.</summary>
public static class BaselineEndpoints
{
    [WolverineGet("/plaintext")]
    public static string Plaintext() => "Hello, World!";
}

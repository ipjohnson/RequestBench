using RequestBench.Domain;

namespace RequestBench.CarterTarget;

/// <summary>What more than one module needs from an HttpRequest.</summary>
public static class Support
{
    /// <summary>
    /// The framework's parsed query, as the lookup the domain takes. The parse is the
    /// framework's, which is what the query family measures.
    /// </summary>
    public static QueryLookup Query(HttpRequest request) =>
        name => request.Query.TryGetValue(name, out var v) ? v.ToString() : null;
}

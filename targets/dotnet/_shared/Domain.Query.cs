namespace RequestBench.Domain;

/// <summary>
/// query: the framework parses the query string, which is the work the family measures;
/// these coerce what it parsed, so every target in the language answers the same values.
/// </summary>
public sealed partial class DomainModel
{
    private static string Str(QueryLookup q, string key) => q(key) ?? string.Empty;

    private static int Int(QueryLookup q, string key) =>
        int.TryParse(q(key), out int n) ? n : 0;

    public static QueryOne CoerceOne(QueryLookup q) => new(Int(q, "page"));

    public static QueryMany CoerceMany(QueryLookup q) => new(
        Int(q, "page"), Int(q, "size"), Str(q, "status"), Str(q, "category"),
        Str(q, "sort"), Str(q, "q"), Int(q, "min_price"), Int(q, "max_price"));
}

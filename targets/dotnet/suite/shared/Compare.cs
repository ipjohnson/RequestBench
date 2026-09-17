using System.Text.Json;
using System.Text.Json.Nodes;

namespace RequestBench.Suite;

public static partial class Floor
{
    /// <summary>
    /// Where the answer and the expectation stop agreeing, as something a person can act on,
    /// or null. <paramref name="a"/> is what the target answered.
    /// </summary>
    /// <remarks>
    /// A port of firstDifference() in client/src/compare.ts, reporting the same field paths
    /// so a suite failure and a `make test` failure can be read side by side. The type names
    /// are Python's, which is where both came from.
    /// </remarks>
    internal static string? FirstDifference(JsonNode? a, JsonNode? b, string path)
    {
        string at = path.Length == 0 ? "response" : path;
        string ta = TypeName(a), tb = TypeName(b);
        // int against float is not a difference: the same number can come back either way.
        bool bothNumbers = ta is "int" or "float" && tb is "int" or "float";
        if (ta != tb && !bothNumbers)
        {
            return $"{at}: {ta} vs {tb}";
        }
        if (a is JsonObject oa && b is JsonObject ob)
        {
            foreach (string k in oa.Select(kv => kv.Key).Union(ob.Select(kv => kv.Key))
                                   .Order(StringComparer.Ordinal))
            {
                if (!oa.ContainsKey(k)) return $"{at}.{k}: missing here, present in the reference";
                if (!ob.ContainsKey(k)) return $"{at}.{k}: present here, missing in the reference";
                if (FirstDifference(oa[k], ob[k], $"{at}.{k}") is string d) return d;
            }
            return null;
        }
        if (a is JsonArray aa && b is JsonArray ab)
        {
            if (aa.Count != ab.Count) return $"{at}: {aa.Count} items vs {ab.Count}";
            for (int i = 0; i < aa.Count; i++)
            {
                if (FirstDifference(aa[i], ab[i], $"{at}[{i}]") is string d) return d;
            }
            return null;
        }
        return Same(a, b) ? null : $"{at}: {Repr(a)} vs {Repr(b)}";
    }

    private static bool Same(JsonNode? a, JsonNode? b)
    {
        if (a is null || b is null) return a is null && b is null;
        if (TypeName(a) is "int" or "float")
        {
            return a.GetValue<double>().Equals(b.GetValue<double>());
        }
        return JsonNode.DeepEquals(a, b);
    }

    /// <summary>Python's type() name for a JSON value, so a mismatch reads the same in both.</summary>
    private static string TypeName(JsonNode? v) => v switch
    {
        null => "NoneType",
        JsonArray => "list",
        JsonObject => "dict",
        JsonValue value => value.GetValueKind() switch
        {
            JsonValueKind.String => "str",
            JsonValueKind.True or JsonValueKind.False => "bool",
            JsonValueKind.Number => Integral(value) ? "int" : "float",
            JsonValueKind.Null => "NoneType",
            _ => "unknown",
        },
        _ => "unknown",
    };

    private static bool Integral(JsonValue v) =>
        v.TryGetValue(out double d) && double.IsInteger(d)
        && !v.ToJsonString().Contains('.', StringComparison.Ordinal)
        && !v.ToJsonString().Contains('e', StringComparison.OrdinalIgnoreCase);

    /// <summary>Python's repr() for a JSON scalar, near enough to diff the two by eye.</summary>
    private static string Repr(JsonNode? v) => v switch
    {
        null => "None",
        JsonValue value when value.GetValueKind() is JsonValueKind.Null => "None",
        JsonValue value when value.GetValueKind() is JsonValueKind.True => "True",
        JsonValue value when value.GetValueKind() is JsonValueKind.False => "False",
        JsonValue value when value.GetValueKind() is JsonValueKind.String =>
            "'" + value.GetValue<string>().Replace("\\", "\\\\", StringComparison.Ordinal)
                       .Replace("'", "\\'", StringComparison.Ordinal) + "'",
        _ => v.ToJsonString(),
    };
}

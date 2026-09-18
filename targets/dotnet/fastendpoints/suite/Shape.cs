using System.Text.Json;
using System.Text.Json.Nodes;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// An error envelope with the values taken out: every key path and the type at it.
///
/// A port of shape_of() in harness/expected.py, which is what wrote the shapes in
/// spec/expected.json. What is being held still is the shape and not the contents: a key
/// appearing, disappearing or changing type is what a changed envelope actually is.
/// </summary>
// rb:test authorized.*,body.*,errors.*
public static class Shape
{
    public static HashSet<string> Of(JsonNode? node, string path = "")
    {
        switch (node)
        {
            case JsonObject obj:
            {
                if (obj.Count == 0)
                {
                    return [path + "{}"];
                }
                HashSet<string> out_ = [];
                foreach ((string key, JsonNode? value) in obj)
                {
                    out_.UnionWith(Of(value, (path.Length > 0 ? path + "." : "") + key));
                }
                return out_;
            }
            case JsonArray arr:
            {
                if (arr.Count == 0)
                {
                    return [path + "[]"];
                }
                HashSet<string> out_ = [];
                foreach (JsonNode? value in arr)
                {
                    out_.UnionWith(Of(value, path + "[]"));
                }
                return out_;
            }
            default:
                return [$"{path}:{Kind(node)}"];
        }
    }

    private static string Kind(JsonNode? node) => node switch
    {
        null => "null",
        JsonValue v => v.GetValueKind() switch
        {
            JsonValueKind.String => "string",
            JsonValueKind.True or JsonValueKind.False => "bool",
            JsonValueKind.Number => "number",
            JsonValueKind.Null => "null",
            _ => "other",
        },
        _ => "other",
    };
}
// rb:end

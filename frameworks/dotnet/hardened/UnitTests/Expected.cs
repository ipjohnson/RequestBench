using System.Text.RegularExpressions;

namespace UnitTests;

/// <summary>What an answer has to be, read from the committed payloads.</summary>
public static partial class Expected
{
    public static JsonNode Settings { get; } = Json("settings.json");

    public static byte[] Bytes(string file) => File.ReadAllBytes(Path.Combine(PayloadsAttribute.Directory, file));

    public static JsonNode Json(string file) => JsonNode.Parse(Bytes(file))!;

    /// <summary>A payload with an echo object beside its own fields, as a binding handler answers.</summary>
    public static JsonNode WithEcho(string file, JsonObject echo)
    {
        JsonObject payload = Json(file).AsObject();
        payload["echo"] = echo;
        return payload;
    }

    /// <summary>The page the template rows render, as tests/payloads/index.ts writes it.</summary>
    public static string Page(string file)
    {
        JsonNode payload = Json(file);
        string rows = string.Concat(payload["items"]!.AsArray().Select(it =>
            $"<tr><td>{(int)it!["id"]!}</td><td>{(string)it["name"]!}</td><td>{(string)it["category"]!}</td>" +
            $"<td>{(int)it["priceCents"]!}</td><td>{((bool)it["inStock"]! ? "yes" : "no")}</td></tr>"));
        return "<!doctype html><html><head><title>items</title></head><body>" +
               $"<h1>{(string)payload["size"]!}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>" +
               $"<tbody>{rows}</tbody></table><p>{(int)payload["count"]!} rows</p></body></html>";
    }

    /// <summary>Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a page.</summary>
    public static string Normal(string html) => Boundary().Replace(Before().Replace(Runs().Replace(html, " "), "<"), ">").Trim();

    [GeneratedRegex("[ \t\n\r\f\v]+")]
    private static partial Regex Runs();

    [GeneratedRegex("[ ]+<")]
    private static partial Regex Before();

    [GeneratedRegex(">[ ]+")]
    private static partial Regex Boundary();
}

public static class Answer
{
    public static async Task<JsonNode> Json(TestWebResponse response) => JsonNode.Parse(await response.ReadTextAsync())!;

    public static async Task Is(JsonNode expected, TestWebResponse response)
    {
        JsonNode actual = await Json(response);
        Assert.True(JsonNode.DeepEquals(expected, actual), $"expected {expected.ToJsonString()}\n     got {actual.ToJsonString()}");
    }

    public static string? Header(TestWebResponse response, string name) =>
        response.Headers.TryGetValue(name, out var value) ? value.ToString() : null;

    public static long Serial(TestWebResponse response) => long.Parse(Header(response, "x-rb-serial")!);
}

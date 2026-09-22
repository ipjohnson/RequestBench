using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace UnitTests;

/// <summary>
/// The Implementation booted in process by FastEndpoints' own fixture. AppFixture wraps
/// WebApplicationFactory and boots one host for every test class that takes it.
/// </summary>
public sealed class App : AppFixture<Program>
{
    // Before the host is built, because Program.cs loads the payloads while it configures the builder.
    protected override ValueTask PreSetupAsync()
    {
        Environment.SetEnvironmentVariable("RB_PAYLOADS", Expected.Directory);
        return ValueTask.CompletedTask;
    }
}

/// <summary>What an answer has to be, read from the committed payloads.</summary>
public static partial class Expected
{
    public static string Directory { get; } = Find();

    public static JsonNode Settings { get; } = Json("settings.json");

    public static byte[] Bytes(string file) => File.ReadAllBytes(Path.Combine(Directory, file));

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

    /// <summary>tests/payloads, found by walking up from the test binary to the repository.</summary>
    private static string Find()
    {
        for (DirectoryInfo? dir = new(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            string candidate = Path.Combine(dir.FullName, "tests", "payloads");
            if (File.Exists(Path.Combine(candidate, "items.large.json")))
            {
                return candidate;
            }
        }
        throw new DirectoryNotFoundException($"no tests/payloads above {AppContext.BaseDirectory}");
    }

    [GeneratedRegex("[ \t\n\r\f\v]+")]
    private static partial Regex Runs();

    [GeneratedRegex("[ ]+<")]
    private static partial Regex Before();

    [GeneratedRegex(">[ ]+")]
    private static partial Regex Boundary();
}

public static class Answer
{
    public static async Task<JsonNode> JsonAsync(HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!;

    public static async Task IsAsync(JsonNode expected, HttpResponseMessage response)
    {
        JsonNode actual = await JsonAsync(response);
        Assert.True(JsonNode.DeepEquals(expected, actual), $"expected {expected.ToJsonString()}\n     got {actual.ToJsonString()}");
    }

    public static async Task<byte[]> BytesAsync(HttpResponseMessage response) =>
        await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);

    public static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out IEnumerable<string>? values) ? string.Join(", ", values)
        : response.Content.Headers.TryGetValues(name, out values) ? string.Join(", ", values)
        : null;

    public static long Serial(HttpResponseMessage response) => long.Parse(Header(response, "x-rb-serial")!);
}

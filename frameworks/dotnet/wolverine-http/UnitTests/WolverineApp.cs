using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Primitives;

namespace UnitTests;

/// <summary>
/// The Implementation booted in process by Alba, which Wolverine's documentation names for HTTP
/// tests. Alba sends each scenario through ASP.NET Core's test server. Every test class shares
/// this one host through the collection below, as that documentation recommends, so no test
/// assumes the output cache or the serial counter starts empty.
/// </summary>
public sealed class WolverineApp : IAsyncLifetime
{
    public IAlbaHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Environment.SetEnvironmentVariable("RB_PAYLOADS", Expected.Directory);
        // Production, as the container runs it.
        Host = await AlbaHost.For<Program>(builder => builder.UseEnvironment(Environments.Production));
    }

    public async Task DisposeAsync() => await Host.DisposeAsync();
}

[CollectionDefinition(nameof(WolverineApp))]
public sealed class WolverineCollection : ICollectionFixture<WolverineApp>;

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
    public static JsonNode Json(IScenarioResult result) => JsonNode.Parse(result.ReadAsText())!;

    public static void Is(JsonNode expected, IScenarioResult result)
    {
        JsonNode actual = Json(result);
        Assert.True(JsonNode.DeepEquals(expected, actual), $"expected {expected.ToJsonString()}\n     got {actual.ToJsonString()}");
    }

    public static string? Header(IScenarioResult result, string name) =>
        result.Context.Response.Headers.TryGetValue(name, out StringValues values) ? values.ToString() : null;

    public static long Serial(IScenarioResult result) => long.Parse(Header(result, "x-rb-serial")!);

    /// <summary>The body as it was written, which for a gzipped answer is not text.</summary>
    public static byte[] Bytes(IScenarioResult result)
    {
        Stream body = result.Context.Response.Body;
        if (body.CanSeek)
        {
            body.Position = 0;
        }
        using MemoryStream copy = new();
        body.CopyTo(copy);
        return copy.ToArray();
    }
}

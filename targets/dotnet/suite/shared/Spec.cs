using System.Text.Json;
using System.Text.Json.Nodes;

namespace RequestBench.Suite;

/// <summary>
/// What a correct answer is, read out of spec/expected.json.
///
/// A suite never decides this for itself. The committed expectation is the only authority
/// and the conformance client is the only thing that judges a target against it, so a suite
/// that passes while `make test` fails that target is the suite that is wrong. Writing the
/// status or the body as a literal in a test is how the two drift apart, which is why the
/// floor assertion is a lookup and not an assertion the author types out.
/// </summary>
public static class Spec
{
    private static readonly Lazy<string> RootPath = new(FindRoot);
    private static readonly Lazy<JsonObject> Requests = new(ReadRequests);

    /// <summary>The repository root, found by walking up from the test assembly.</summary>
    /// <remarks>
    /// A test host runs from suite/bin/&lt;config&gt;/net10.0, which is four levels under the
    /// target and six under the root, and the relative path differs again under `dotnet test`
    /// against a solution. Searching for the file that has to be there is the one way that
    /// does not encode a build layout.
    /// </remarks>
    public static string Root => RootPath.Value;

    private static string FindRoot()
    {
        for (DirectoryInfo? at = new(AppContext.BaseDirectory); at is not null; at = at.Parent)
        {
            if (File.Exists(Path.Combine(at.FullName, "spec", "expected.json")))
            {
                return at.FullName;
            }
        }
        throw new InvalidOperationException(
            $"no spec/expected.json above {AppContext.BaseDirectory}");
    }

    /// <summary>The fixture path a target reads, as an absolute path.</summary>
    /// <remarks>
    /// harness/run.py hands a booted target RB_FIXTURE. A test host boots the target in
    /// process instead, from a working directory the relative fallback in DomainModel does
    /// not resolve against, so the suite sets the same variable for the same reason.
    /// </remarks>
    public static string FixturePath => Path.Combine(Root, "spec", "fixture.json");

    private static JsonObject ReadRequests()
    {
        using FileStream stream = File.OpenRead(Path.Combine(Root, "spec", "expected.json"));
        JsonNode root = JsonNode.Parse(stream)
                        ?? throw new InvalidOperationException("spec/expected.json is empty");
        return root["requests"]?.AsObject()
               ?? throw new InvalidOperationException("spec/expected.json has no requests");
    }

    /// <summary>The expectation for an endpoint that sends one distinct request.</summary>
    /// <exception cref="InvalidOperationException">
    /// When the endpoint has more than one, which is not a case a caller can be allowed to
    /// resolve by taking the first: the query and header families vary the request and each
    /// variation has its own answer.
    /// </exception>
    public static Expectation For(string endpointId)
    {
        string[] keys = [.. Requests.Value
            .Where(kv => kv.Key.StartsWith(endpointId + " ", StringComparison.Ordinal))
            .Select(kv => kv.Key)
            .Order(StringComparer.Ordinal)];
        return keys switch
        {
            [] => throw new InvalidOperationException(
                $"spec/expected.json says nothing about {endpointId}"),
            [string one] => At(one),
            _ => throw new InvalidOperationException(
                $"{endpointId} sends {keys.Length} distinct requests; name the path: "
                + string.Join(", ", keys.Select(k => k[(endpointId.Length + 1)..]))),
        };
    }

    /// <summary>The expectation for one request of an endpoint that sends several.</summary>
    public static Expectation For(string endpointId, string path) => At($"{endpointId} {path}");

    private static Expectation At(string key)
    {
        JsonObject want = Requests.Value[key]?.AsObject()
                          ?? throw new InvalidOperationException(
                              $"spec/expected.json says nothing about {key}");
        return new Expectation(
            Key: key,
            Path: key[(key.IndexOf(' ') + 1)..],
            Status: want["status"]!.GetValue<int>(),
            BodyClass: want["body_class"]?.GetValue<string>(),
            Encoding: want["encoding"]?.GetValue<string>(),
            Body: want["body"]);
    }
}

/// <summary>
/// One request's expected answer.
///
/// BodyClass and Encoding are null where spec/expected.json deliberately does not pin the
/// field, which its own "unpinned" block explains. compressed.gzip_small is the one this
/// family meets: the payload sits near the shared gzip floor, the frameworks disagree about
/// whether to compress it, and the expectation records the disagreement rather than choosing
/// a winner. A null is not checked.
/// </summary>
/// <param name="Key">The spec/expected.json key, for a failure message that can be grepped.</param>
public sealed record Expectation(
    string Key, string Path, int Status, string? BodyClass, string? Encoding, JsonNode? Body);

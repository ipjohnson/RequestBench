using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// The request an endpoint sends, read out of spec/plan.json.
///
/// The same argument as <see cref="Spec"/>. A suite writes its own arrange and its own act,
/// because the difference between two frameworks there is the thing being captured, but the
/// values in the request are not the suite's to choose. spec/plan.json is where an order id,
/// a query string and a request body come from, and a test that typed one out would be
/// asserting against a request the measurement never sends.
/// </summary>
// rb:test *
public static partial class Plan
{
    private static readonly Lazy<JsonObject> Document = new(Read);
    private static readonly Lazy<Dictionary<string, JsonNode>> Values = new(Draw);

    private static JsonObject Read()
    {
        using FileStream stream = File.OpenRead(Path.Combine(Spec.Root, "spec", "plan.json"));
        return JsonNode.Parse(stream)?.AsObject()
               ?? throw new InvalidOperationException("spec/plan.json is empty");
    }

    /// <summary>A value for each of the plan's run_values, drawn once for the process.</summary>
    /// <remarks>
    /// spec/plan.json holds only how each one is drawn, so that no target can know the value
    /// in advance. harness/run.py hands the values it draws to the drivers and not to a
    /// suite, so a suite draws its own.
    /// </remarks>
    private static Dictionary<string, JsonNode> Draw() =>
        (Document.Value["run_values"]?.AsObject() ?? [])
            .ToDictionary(kv => kv.Key, kv => Drawn(kv.Value!.AsObject()));

    /// <summary>One value: an int as a JSON number and anything else as a JSON string.</summary>
    private static JsonNode Drawn(JsonObject rule)
    {
        string Chars() => RandomNumberGenerator.GetString(
            rule["chars"]!.GetValue<string>(), rule["length"]!.GetValue<int>());
        switch (rule["kind"]!.GetValue<string>())
        {
            case "int":
                int low = (int)Math.Pow(10, rule["digits"]!.GetValue<int>() - 1);
                // Parsed rather than made by JsonValue.Create(int), whose node throws when
                // Floor reads it with GetValue<double>.
                return JsonNode.Parse($"{RandomNumberGenerator.GetInt32(low, low * 10)}")!;
            case "string":
                return JsonValue.Create(Chars());
            case "words":
                int count = rule["count"]!.GetValue<int>();
                return JsonValue.Create(
                    string.Join(' ', Enumerable.Range(0, count).Select(_ => Chars())));
            case "choice":
                JsonArray choices = rule["values"]!.AsArray();
                return choices[RandomNumberGenerator.GetInt32(choices.Count)]!.DeepClone();
            default:
                throw new InvalidOperationException(
                    $"spec/plan.json has a run value of unknown kind {rule["kind"]}");
        }
    }

    private static JsonObject Endpoint(string endpointId) =>
        Document.Value["endpoints"]!.AsArray()
            .Select(node => node!.AsObject())
            .FirstOrDefault(ep => ep["id"]!.GetValue<string>() == endpointId)
        ?? throw new InvalidOperationException($"spec/plan.json has no endpoint {endpointId}");

    /// <summary>One of an endpoint's requests, and the answer spec/expected.json pins for it.</summary>
    /// <remarks>
    /// Instance zero, always. An endpoint sends up to 512 of them and the conformance client
    /// replays every one; a suite is a test and sends one, so which one has to be the same on
    /// every machine and every run or a failure would not reproduce.
    /// </remarks>
    public static Ask For(string endpointId)
    {
        JsonObject ep = Endpoint(endpointId);
        string path = ep["paths"]!.AsArray()[0]!.GetValue<string>();
        Dictionary<string, string> headers = [];
        foreach ((string name, JsonNode? value) in ep["headers"]?.AsObject() ?? [])
        {
            headers[name] = InHeader(value!.GetValue<string>());
        }
        // A vary row sends a different header set per instance, and which combination it is
        // is what the response cache is keyed on. Instance zero, for the reason above.
        if (ep["header_variants"]?.AsArray() is { Count: > 0 } variants)
        {
            foreach ((string name, JsonNode? value) in variants[0]!.AsObject())
            {
                headers[name] = InHeader(value!.GetValue<string>());
            }
        }
        string? body = ep["body"]?.GetValue<string>();
        if (body is not null)
        {
            headers["content-type"] = "application/json";
        }
        return new Ask(
            Id: endpointId,
            Key: $"{endpointId} {path}",
            Method: ep["method"]!.GetValue<string>(),
            Path: InPath(path),
            Headers: headers,
            Body: body,
            // An error endpoint has no pinned request. Its envelope is the framework's own
            // contract, so spec/expected.json describes it under `errors` and `targets`
            // instead, and Envelope rather than Floor is what judges the answer.
            Want: Spec.IsError(endpointId) ? null : Filled(Spec.For(endpointId, path)));
    }

    /// <summary>The request a capture is taken from, for the endpoints that need one first.</summary>
    /// <remarks>
    /// etag.match_large is the only one. Its if-none-match carries {capture.etag_large}, which
    /// is a validator only the target can produce, so the request cannot be sent until the
    /// target has answered a different one. Two phases is the endpoint's own shape rather than
    /// a thing the suite decided to do.
    /// </remarks>
    public static (string Method, string Path, string Header)? CaptureFor(Ask ask)
    {
        foreach ((string name, string value) in ask.Headers)
        {
            if (!value.StartsWith("{capture.", StringComparison.Ordinal))
            {
                continue;
            }
            string key = value[9..^1];
            JsonObject capture = Document.Value["captures"]?[key]?.AsObject()
                ?? throw new InvalidOperationException($"spec/plan.json has no capture {key}");
            return (capture["method"]!.GetValue<string>(),
                    capture["path"]!.GetValue<string>(),
                    capture["header"]!.GetValue<string>());
        }
        return null;
    }

    /// <summary>The same headers with a capture's placeholder replaced by what was captured.</summary>
    public static Dictionary<string, string> Resolved(Ask ask, string captured) =>
        ask.Headers.ToDictionary(
            kv => kv.Key,
            kv => kv.Value.StartsWith("{capture.", StringComparison.Ordinal) ? captured : kv.Value);

    /// <summary>A path from the plan with each run value in it, percent-encoded.</summary>
    /// <remarks>
    /// A space goes as %20 and never +, because RFC 3986 does not read + as a space.
    /// </remarks>
    private static string InPath(string path) =>
        Placeholder().Replace(path, m => Uri.EscapeDataString(Sent(m)));

    /// <summary>A header value from the plan with each run value in it, as it is.</summary>
    private static string InHeader(string value) => Placeholder().Replace(value, Sent);

    /// <summary>The value sent for a placeholder. A string node's ToString has no quotes.</summary>
    private static string Sent(Match placeholder) =>
        ValueOf(placeholder.Groups[1].Value).ToString();

    private static JsonNode ValueOf(string name) =>
        Values.Value.TryGetValue(name, out JsonNode? value)
            ? value
            : throw new InvalidOperationException($"spec/plan.json has no run value {name}");

    /// <summary>The pinned answer with each run value in its body.</summary>
    /// <remarks>
    /// spec/expected.json cannot hold a value drawn after it was written, so it holds the
    /// placeholder, always as a whole string. The body is rebuilt rather than edited, because
    /// the original belongs to the parsed spec/expected.json that every test reads.
    /// </remarks>
    private static Expectation Filled(Expectation want)
    {
        return want with { Body = Fill(want.Body) };

        static JsonNode? Fill(JsonNode? node) => node switch
        {
            JsonObject obj => new JsonObject(
                obj.Select(kv => KeyValuePair.Create(kv.Key, Fill(kv.Value)))),
            JsonArray items => new JsonArray([.. items.Select(Fill)]),
            JsonValue value when value.TryGetValue(out string? text)
                                 && Placeholder().Match(text) is { Success: true } m
                                 && m.Value == text
                => ValueOf(m.Groups[1].Value).DeepClone(),
            _ => node?.DeepClone(),
        };
    }

    [GeneratedRegex(@"\{run\.([a-z_]+)\}")] private static partial Regex Placeholder();
}
// rb:end

/// <summary>One request an endpoint sends, and the answer pinned for it.</summary>
/// <param name="Key">The spec/expected.json key: the id and the path as the plan writes it.</param>
/// <param name="Path">The path as it is sent, with each run value in it.</param>
/// <param name="Want">Null for an error endpoint; see <see cref="Envelope"/>.</param>
// rb:test *
public sealed record Ask(
    string Id, string Key, string Method, string Path,
    Dictionary<string, string> Headers, string? Body, Expectation? Want);
// rb:end

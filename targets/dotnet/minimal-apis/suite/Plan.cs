using System.Text.Json.Nodes;

namespace RequestBench.MinimalApis.Suite;

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
public static class Plan
{
    private static readonly Lazy<JsonObject> Document = new(Read);

    private static JsonObject Read()
    {
        using FileStream stream = File.OpenRead(Path.Combine(Spec.Root, "spec", "plan.json"));
        return JsonNode.Parse(stream)?.AsObject()
               ?? throw new InvalidOperationException("spec/plan.json is empty");
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
            headers[name] = value!.GetValue<string>();
        }
        // A vary row sends a different header set per instance, and which combination it is
        // is what the response cache is keyed on. Instance zero, for the reason above.
        if (ep["header_variants"]?.AsArray() is { Count: > 0 } variants)
        {
            foreach ((string name, JsonNode? value) in variants[0]!.AsObject())
            {
                headers[name] = value!.GetValue<string>();
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
            Path: path,
            Headers: headers,
            Body: body,
            // An error endpoint has no pinned request. Its envelope is the framework's own
            // contract, so spec/expected.json describes it under `errors` and `targets`
            // instead, and Envelope rather than Floor is what judges the answer.
            Want: Spec.IsError(endpointId) ? null : Spec.For(endpointId, path));
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
}
// rb:end

/// <summary>One request an endpoint sends, and the answer pinned for it.</summary>
/// <param name="Key">The spec/expected.json key, which is the id and the path.</param>
/// <param name="Want">Null for an error endpoint; see <see cref="Envelope"/>.</param>
// rb:test *
public sealed record Ask(
    string Id, string Key, string Method, string Path,
    Dictionary<string, string> Headers, string? Body, Expectation? Want);
// rb:end

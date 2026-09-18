using System.Text.Json;
using System.Text.Json.Nodes;

namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// What an error endpoint has to answer, which is not what a 2xx endpoint has to answer.
///
/// A 2xx body is the controlled variable and spec/expected.json pins it exactly. An error
/// envelope is the framework's own contract, so there is nothing to pin: what is held is the
/// status, the kind of body, and the shape this target recorded, which is the envelope with
/// the values taken out. The shape rather than the body, because ASP.NET's ProblemDetails
/// carries a traceId that changes per connection and an exact body could never match twice.
///
/// The framework-agnostic contract in `errors` is deliberately not what this reads. That
/// block says what the plan intends, and a framework is allowed to declare otherwise: the
/// client-exception package beside each target is where it does, and minimal-apis uses it to
/// say that a body AddValidation could not read is a bare 400 and not the 422 the plan asks
/// for. Those packages are TypeScript read by the conformance client, so reconciling the two
/// is the client's job and not a suite's. A suite reads what this target recorded, which is
/// the same answer arrived at from the other side.
/// </summary>
// rb:test authorized.*,body.*,errors.*
public static class Envelope
{
    /// <summary>Assert an error answer, or throw naming the first thing that differs.</summary>
    public static async Task AssertAsync(HttpResponseMessage response, Ask ask, string target)
    {
        byte[] raw = await response.Content.ReadAsByteArrayAsync();
        Assert((int)response.StatusCode,
               response.Content.Headers.ContentType?.ToString() ?? "",
               raw, ask, target);
    }

    /// <summary>The same, for a host that hands back no HttpResponseMessage.</summary>
    public static void Assert(int status, string contentType, byte[] raw, Ask ask, string target)
    {
        if (Difference(status, contentType, raw, ask, target) is string why)
        {
            Xunit.Assert.Fail($"{ask.Key}: {why}");
        }
    }

    /// <summary>Why this error answer is not the expected one, or null.</summary>
    public static string? Difference(int status, string contentType, byte[] raw,
                                     Ask ask, string target)
    {
        if (Spec.Envelope(target, ask.Key) is not JsonObject recorded)
        {
            return $"spec/expected.json records no envelope for {target}";
        }
        if (status != recorded["status"]!.GetValue<int>())
        {
            return $"expected {recorded["status"]}, got {status}";
        }
        string got = Floor.BodyClass(contentType);
        if (got != recorded["body_class"]!.GetValue<string>())
        {
            return $"expected a {recorded["body_class"]} body, got {got}";
        }
        string[] want = [.. recorded["shape"]!.AsArray().Select(n => n!.GetValue<string>())];
        string[] have = [.. Shape.Of(raw.Length == 0 ? null : Parse(raw))
                              .Order(StringComparer.Ordinal)];
        string[] missing = [.. want.Except(have, StringComparer.Ordinal)];
        string[] extra = [.. have.Except(want, StringComparer.Ordinal)];
        if (missing.Length == 0 && extra.Length == 0)
        {
            return null;
        }
        return "the envelope shape moved: " + string.Join("; ", new[]
        {
            missing.Length > 0 ? "missing " + string.Join(", ", missing) : null,
            extra.Length > 0 ? "added " + string.Join(", ", extra) : null,
        }.Where(s => s is not null));
    }

    private static JsonNode? Parse(byte[] raw)
    {
        try
        {
            return JsonNode.Parse(raw);
        }
        catch (JsonException)
        {
            return JsonValue.Create("unparseable-json");
        }
    }
}
// rb:end

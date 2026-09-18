using System.IO.Compression;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>What every test asserts before it asserts anything of its own.</summary>
/// <remarks>
/// A port of difference() in client/src/expectation.ts, in its order and with its rules. The
/// order is the point: a target answering the right values as text/plain is not answering
/// correctly, so the kind of body is checked before the body. Getting this wrong in either
/// direction is the failure mode the suites have to be built against, because a suite that
/// is stricter than the client fails a target the client passes, and one that is looser
/// passes a target `make test` rejects.
/// </remarks>
// rb:test *
public static partial class Floor
{
    /// <summary>Assert the floor against a planned request's pinned answer.</summary>
    public static async Task AssertAsync(HttpResponseMessage response, Ask ask) =>
        await AssertAsync(response, ask.Want
            ?? throw new InvalidOperationException(
                $"{ask.Id} is an error endpoint; assert it with Envelope"));

    /// <summary>Assert the floor against an expectation the caller already resolved.</summary>
    public static async Task AssertAsync(HttpResponseMessage response, Expectation want)
    {
        byte[] raw = await response.Content.ReadAsByteArrayAsync();
        string encoding = string.Join(", ", response.Content.Headers.ContentEncoding);
        string contentType = response.Content.Headers.ContentType?.ToString() ?? "";
        string? why = Difference(want, (int)response.StatusCode, contentType, encoding, raw);
        if (why is not null)
        {
            Xunit.Assert.Fail($"{want.Key}: {why}");
        }
    }

    /// <summary>Why this answer is not the expected one, or null.</summary>
    public static string? Difference(
        Expectation want, int status, string contentType, string encoding, byte[] raw)
    {
        if (status != want.Status)
        {
            return $"expected {want.Status}, got {status}";
        }
        string got = BodyClass(contentType);
        if (want.BodyClass is not null && got != want.BodyClass)
        {
            return $"expected a {want.BodyClass} body, got {got}";
        }
        if (want.Encoding is not null && encoding != want.Encoding)
        {
            return $"expected content-encoding {Named(want.Encoding)}, got {Named(encoding)}";
        }
        return FirstDifference(Comparable(Decoded(raw, encoding), contentType), want.Body, "");
    }

    private static string Named(string encoding) => encoding.Length == 0 ? "identity" : encoding;

    /// <summary>
    /// The bytes to compare, which are not always the bytes on the wire. gzip output differs
    /// between zlib, Java's Deflater and Go's compress/flate at the same level; the
    /// decompressed bytes must not.
    /// </summary>
    private static byte[] Decoded(byte[] raw, string encoding)
    {
        if (raw.Length == 0 || !encoding.Contains("gzip", StringComparison.Ordinal))
        {
            return raw;
        }
        try
        {
            using MemoryStream compressed = new(raw);
            using GZipStream gzip = new(compressed, CompressionMode.Decompress);
            using MemoryStream plain = new();
            gzip.CopyTo(plain);
            return plain.ToArray();
        }
        catch (InvalidDataException)
        {
            return raw;
        }
    }

    /// <summary>What kind of body this is, which is part of the contract rather than incidental.</summary>
    internal static string BodyClass(string contentType)
    {
        string ctype = contentType.ToLowerInvariant();
        if (ctype.Contains("json", StringComparison.Ordinal)) return "json";
        if (ctype.Contains("html", StringComparison.Ordinal)) return "html";
        if (ctype.Contains("text", StringComparison.Ordinal)) return "text";
        return ctype.Length == 0 ? "none" : "other";
    }

    /// <summary>
    /// The response as a value rather than as bytes. Key order follows whatever the
    /// language's serializer does and a number can come back 18928 or 18928.0, so parsing
    /// first makes those stop mattering.
    /// </summary>
    private static JsonNode? Comparable(byte[] raw, string contentType)
    {
        if (raw.Length == 0)
        {
            return null;
        }
        if (contentType.Contains("json", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                return JsonNode.Parse(raw);
            }
            catch (System.Text.Json.JsonException)
            {
                return JsonValue.Create("unparseable-json");
            }
        }
        string text = Encoding.UTF8.GetString(raw);
        if (contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
        {
            // Five template engines cannot agree on formatting without every template being
            // contorted to match, so the spec pins content and leaves whitespace free.
            text = AsciiRuns().Replace(text, " ");
            text = AfterTag().Replace(text, ">");
            text = BeforeTag().Replace(text, "<");
            text = text.Trim();
        }
        return JsonValue.Create(text);
    }

    [GeneratedRegex("[ \t\n\r\f\v]+")] private static partial Regex AsciiRuns();
    [GeneratedRegex("> +")] private static partial Regex AfterTag();
    [GeneratedRegex(" +<")] private static partial Regex BeforeTag();
}
// rb:end


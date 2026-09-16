using System.Collections.Frozen;
using System.IO.Compression;
using System.Text.Json;

namespace RequestBench.Domain;

/// <summary>
/// Behaviour shared by every .NET target. Frameworks differ only in how they bind routes to
/// these methods, so the measured delta is framework overhead.
///
/// A port of targets/python/_shared/domain.py, which is a port of the Rust and Go domains.
/// Where the languages could differ -- field order in a 422 body, an empty list versus a
/// missing one, the tiebreak in a sort -- this follows what spec/expected.json records.
///
/// An instance rather than a static class, registered once in the service collection by
/// <see cref="ServiceCollectionExtensions.AddRequestBenchDomain"/>. Six targets injecting
/// the same singleton is what makes "behaviour is shared" something the compiler checks
/// rather than a convention.
/// </summary>
public sealed partial class DomainModel
{
    private readonly FrozenDictionary<int, Product> _productById;
    private readonly FrozenDictionary<int, Customer> _customerById;
    private readonly FrozenDictionary<int, Order> _orderById;
    private readonly FrozenDictionary<string, PayloadDoc> _payloads;
    private readonly string _token;
    private int _serial;

    public IReadOnlyList<Order> Orders { get; }
    public IReadOnlyList<Customer> Customers { get; }

    /// <summary>
    /// The id a created order would get. The fixture holds 1..1000, so it is 1001:
    /// synthetic and deterministic, which is all a Location header needs when nothing is
    /// persisted.
    /// </summary>
    public int NextOrderId { get; }

    public DomainModel(Fixture fixture)
    {
        Orders = fixture.Orders;
        Customers = fixture.Customers;
        NextOrderId = fixture.Orders.Count + 1;
        _productById = fixture.Products.ToFrozenDictionary(p => p.Id);
        _customerById = fixture.Customers.ToFrozenDictionary(c => c.Id);
        _orderById = fixture.Orders.ToFrozenDictionary(o => o.Id);
        _payloads = fixture.Payloads.ToFrozenDictionary();
        _token = fixture.Auth.Token;
    }

    /// <summary>The path the fixture is read from, honouring the variable every language uses.</summary>
    public static string FixturePath() =>
        Environment.GetEnvironmentVariable("RB_FIXTURE") ?? "../../spec/fixture.json";

    public static DomainModel Load(string path)
    {
        using FileStream stream = File.OpenRead(path);
        Fixture fixture = JsonSerializer.Deserialize<Fixture>(stream, Json.Options)
                          ?? throw new InvalidOperationException($"{path}: empty fixture");
        return new DomainModel(fixture);
    }

    // ---- blend-v2 responses ---------------------------------------------------------

    /// <summary>
    /// Not pre-serialized. json.small against json.large is one fixture read, one serialize
    /// and one write at three sizes; handing back a cached string would measure none of it.
    /// </summary>
    public PayloadBody Payload(string size) => _payloads[size].Body;

    /// <summary>
    /// Pinned in the fixture, so what a target spends is emitting the header and comparing
    /// it rather than hashing a body.
    /// </summary>
    public string ETagOf(string size) => _payloads[size].Etag;

    /// <summary>
    /// Pinned across every language. Compression cost is dominated by codec and level, not
    /// by framework, so an unpinned level makes compressed.* a zlib benchmark.
    /// </summary>
    public const CompressionLevel GzipLevel = CompressionLevel.Optimal;

    /// <summary>The floor the .NET response compression middleware uses by default.</summary>
    public const int GzipMinSize = 1024;

    public const string Cacheable = "public, max-age=60";

    /// <summary>Compresses at the pinned level, for a target whose framework brings no compressor.</summary>
    public static byte[] Gzip(ReadOnlySpan<byte> raw)
    {
        using var buffer = new MemoryStream(raw.Length / 2);
        using (var gzip = new GZipStream(buffer, GzipLevel, leaveOpen: true))
        {
            gzip.Write(raw);
        }
        return buffer.ToArray();
    }

    /// <summary>
    /// x-rb-serial, monotonic per process. A response served from a cache anywhere in the
    /// path, or precomputed at boot, repeats a number it did not increment, and identical
    /// bytes are the whole point of the fingerprint.
    /// </summary>
    public string NextSerial() => Interlocked.Increment(ref _serial).ToString();

    /// <summary>
    /// The denial arm's token differs only in its last character, so this compares the whole
    /// string rather than failing on length. Crypto is not framework cost.
    /// </summary>
    public bool TokenOk(string? header) =>
        header is not null && header.StartsWith("Bearer ", StringComparison.Ordinal)
        && header.AsSpan(7).SequenceEqual(_token);

    /// <summary>
    /// The Location a created order points at. Built by concatenation rather than
    /// interpolation: "/domain/orders/{id}" is indistinguishable from a route with a
    /// capture, and harness/snippets.py then finds the domain routes in two places and
    /// refuses to guess.
    /// </summary>
    public string CreatedLocation() => "/domain/orders/" + NextOrderId.ToString();

    public static IReadOnlyDictionary<string, string> NotFoundBody() =>
        new Dictionary<string, string> { ["error"] = "not_found" };

    public static IReadOnlyDictionary<string, string> ForbiddenBody() =>
        new Dictionary<string, string> { ["error"] = "forbidden" };

    public static IReadOnlyDictionary<string, object> InvalidBody(IReadOnlyList<FieldError> errors) =>
        new Dictionary<string, object> { ["error"] = "validation_failed", ["errors"] = errors };
}

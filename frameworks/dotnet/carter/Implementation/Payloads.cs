using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace Implementation;

/// <summary>One row of items.large, and of every payload made from it.</summary>
public sealed record Item(int Id, string Name, string Category, int PriceCents, bool InStock);

/// <summary>items.small, items.medium or items.large.</summary>
public sealed record Payload(string Size, int Count, IReadOnlyList<Item> Items);

/// <summary>The values the framework configures itself from, as settings.json holds them.</summary>
public sealed record Settings(string Token, string WrongToken, string StaleEtag, CacheSettings Cache, CorsSettings Cors);

public sealed record CacheSettings(int Capacity, int TtlSeconds, VarySettings Vary);

/// <summary>The values each vary row is keyed on, by header.</summary>
public sealed record VarySettings(IReadOnlyDictionary<string, string[]> One, IReadOnlyDictionary<string, string[]> Many);

public sealed record CorsSettings(string Origin, string Method, string Header, int MaxAgeSeconds);

/// <summary>
/// The committed payloads, read from the directory RB_PAYLOADS names before the server
/// starts, so a missing or broken file stops the boot rather than failing a request. The
/// parsed objects are kept and serialised on every request.
/// </summary>
public sealed class Payloads
{
    public required string Directory { get; init; }

    public required Payload Small { get; init; }

    public required Payload Medium { get; init; }

    public required Payload Large { get; init; }

    public required Settings Settings { get; init; }

    private IReadOnlyDictionary<int, Item> Rows { get; init; } = new Dictionary<int, Item>();

    public static Payloads Load(string directory)
    {
        // The static-file feature serves this directory, and only takes an absolute path.
        directory = Path.GetFullPath(directory);
        Payload large = Read(directory, "items.large.json", JsonContext.Default.Payload);
        return new Payloads
        {
            Directory = directory,
            Small = Read(directory, "items.small.json", JsonContext.Default.Payload),
            Medium = Read(directory, "items.medium.json", JsonContext.Default.Payload),
            Large = large,
            Settings = Read(directory, "settings.json", JsonContext.Default.Settings),
            Rows = large.Items.ToDictionary(row => row.Id),
        };
    }

    /// <summary>The row of items.large with this id, or null when there is none.</summary>
    public Item? Row(int id) => Rows.GetValueOrDefault(id);

    private static T Read<T>(string directory, string file, JsonTypeInfo<T> type) =>
        JsonSerializer.Deserialize(File.ReadAllBytes(Path.Combine(directory, file)), type)
        ?? throw new InvalidDataException($"{file} holds no value");
}

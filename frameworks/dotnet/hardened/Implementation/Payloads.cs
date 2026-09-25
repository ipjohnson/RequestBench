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
/// The committed payloads. A handler asks for this interface, because Hardened binds a parameter
/// typed as a concrete class from the request body.
/// </summary>
public interface IPayloads
{
    /// <summary>The payload directory, which the static content mount serves.</summary>
    string Directory { get; }

    Payload Small { get; }

    Payload Medium { get; }

    Payload Large { get; }

    Settings Settings { get; }

    /// <summary>The row of items.large with this id, or null when there is none.</summary>
    Item? Row(int id);
}

/// <summary>
/// The payloads read from the directory RB_PAYLOADS names. The library module loads them while
/// the application's services are registered, before any host starts, so a missing or broken file
/// stops the boot rather than failing a request. The parsed objects are kept and serialised on
/// every request.
/// </summary>
public sealed class Payloads : IPayloads
{
    private readonly Dictionary<int, Item> rows;

    private Payloads(string directory, Payload small, Payload medium, Payload large, Settings settings)
    {
        Directory = directory;
        Small = small;
        Medium = medium;
        Large = large;
        Settings = settings;
        rows = large.Items.ToDictionary(row => row.Id);
    }

    public string Directory { get; }

    public Payload Small { get; }

    public Payload Medium { get; }

    public Payload Large { get; }

    public Settings Settings { get; }

    public Item? Row(int id) => rows.GetValueOrDefault(id);

    public static Payloads Load(string directory)
    {
        directory = Path.GetFullPath(directory);
        return new Payloads(
            directory,
            Read(directory, "items.small.json", JsonContext.Default.Payload),
            Read(directory, "items.medium.json", JsonContext.Default.Payload),
            Read(directory, "items.large.json", JsonContext.Default.Payload),
            Read(directory, "settings.json", JsonContext.Default.Settings));
    }

    private static T Read<T>(string directory, string file, JsonTypeInfo<T> type) =>
        JsonSerializer.Deserialize(File.ReadAllBytes(Path.Combine(directory, file)), type)
        ?? throw new InvalidDataException($"{file} holds no value");
}

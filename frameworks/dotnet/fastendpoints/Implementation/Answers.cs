using FastEndpoints;

namespace Implementation;

/// <summary>A payload with the values a handler bound written back beside its own fields.</summary>
public sealed record Echoed<T>(string Size, int Count, IReadOnlyList<Item> Items, T Echo)
{
    public Echoed(Payload payload, T echo)
        : this(payload.Size, payload.Count, payload.Items, echo)
    {
    }
}

// Request types are classes with setters, because FastEndpoints.Generator writes binding code
// for those and leaves records and init-only properties to runtime compilation. The five below
// are also the echo their route answers with.

public sealed class ParametersOne
{
    public int One { get; set; }
}

public sealed class ParametersTwo
{
    public int One { get; set; }

    public int Two { get; set; }
}

public sealed class QueryOne
{
    public int Page { get; set; }
}

/// <summary>query.many's eight values, which forms.urlencoded posts as a form.</summary>
public sealed class Search
{
    public int Page { get; set; }

    public int Size { get; set; }

    public string Status { get; set; } = "";

    public string Category { get; set; } = "";

    public string Sort { get; set; } = "";

    public string Q { get; set; } = "";

    public int MinPrice { get; set; }

    public int MaxPrice { get; set; }
}

public sealed class HeadersBound
{
    [FromHeader("x-rb-tenant")]
    public string Tenant { get; set; } = "";

    [FromHeader("x-rb-request-id")]
    public string RequestId { get; set; } = "";

    [FromHeader("x-rb-account")]
    public int Account { get; set; }
}

/// <summary>
/// What a bind or validate row answers: the order back, with the leaves the handler found
/// in it and the bytes it received.
/// </summary>
public sealed record Bound(int Fields, long Bytes, OrderRequest Echo)
{
    /// <summary>customerId and status, and a productId and a qty per line.</summary>
    public static Bound Of(OrderRequest order, HttpRequest request) =>
        new(2 + (2 * order.Lines.Count), request.ContentLength ?? 0, order);
}

/// <summary>The id in an item's path.</summary>
public sealed class ItemId
{
    public int Id { get; set; }
}

/// <summary>An item as a client creates one.</summary>
public class NewItem
{
    public string Name { get; set; } = "";

    public string Category { get; set; } = "";

    public int PriceCents { get; set; }

    public bool InStock { get; set; }

    public Item At(int id) => new(id, Name, Category, PriceCents, InStock);
}

/// <summary>An item put at the id in its path, which FastEndpoints binds after the body.</summary>
public sealed class ReplacedItem : NewItem
{
    public int Id { get; set; }
}

/// <summary>The two fields items.update changes, and the id in the path.</summary>
public sealed class ItemPatch
{
    public int Id { get; set; }

    public int? PriceCents { get; set; }

    public bool? InStock { get; set; }

    public Item Onto(Item row) => row with { PriceCents = PriceCents ?? row.PriceCents, InStock = InStock ?? row.InStock };
}

public sealed class Upload
{
    public string Tenant { get; set; } = "";

    public string RequestId { get; set; } = "";

    public IFormFile File { get; set; } = null!;
}

public sealed record UploadedFile(string Name, long Bytes);

public sealed record UploadEcho(string Tenant, string RequestId);

public sealed record Uploaded(UploadedFile File, UploadEcho Echo);

/// <summary>/__meta: what ran, recorded on the result row and never checked.</summary>
public sealed record Meta(string Framework, string Version, string Runtime, double? BootMs);

namespace Implementation;

/// <summary>A payload with the values an action bound written back beside its own fields.</summary>
public sealed record Echoed<T>(string Size, int Count, IReadOnlyList<Item> Items, T Echo)
{
    public Echoed(Payload payload, T echo)
        : this(payload.Size, payload.Count, payload.Items, echo)
    {
    }
}

public sealed record ParametersOne(int One);

public sealed record ParametersTwo(int One, int Two);

public sealed record QueryOne(int Page);

/// <summary>query.many's eight values, which forms.urlencoded posts as a form.</summary>
public sealed record Search(int Page, int Size, string Status, string Category, string Sort, string Q, int MinPrice, int MaxPrice);

public sealed record HeadersBound(string Tenant, string RequestId, int Account);

/// <summary>
/// What a bind or validate row answers: the order back, with the leaves the action found
/// in it and the bytes it received.
/// </summary>
public sealed record Bound(int Fields, long Bytes, OrderRequest Echo)
{
    /// <summary>customerId and status, and a productId and a qty per line.</summary>
    public static Bound Of(OrderRequest order, HttpRequest request) =>
        new(2 + (2 * order.Lines.Count), request.ContentLength ?? 0, order);
}

/// <summary>An item as a client creates or replaces one.</summary>
public sealed record NewItem(string Name, string Category, int PriceCents, bool InStock)
{
    public Item At(int id) => new(id, Name, Category, PriceCents, InStock);
}

/// <summary>The two fields items.update changes.</summary>
public sealed record ItemPatch(int? PriceCents, bool? InStock)
{
    public Item Onto(Item row) => row with { PriceCents = PriceCents ?? row.PriceCents, InStock = InStock ?? row.InStock };
}

public sealed record UploadedFile(string Name, long Bytes);

public sealed record UploadEcho(string Tenant, string RequestId);

public sealed record Uploaded(UploadedFile File, UploadEcho Echo);

/// <summary>/__meta: what ran, recorded on the result row and never checked.</summary>
public sealed record Meta(string Framework, string Version, string Runtime, string Adapter, double? BootMs);

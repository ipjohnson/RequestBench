using ValidationModules.Constraints;

namespace Implementation;

// rb:wiring body.*
/// <summary>
/// The body the bind and validate rows send, carrying the rules orderRequest states as Hardened's
/// constraint attributes. Hardened.Validation.SourceGenerator compiles them into a check that runs
/// before any handler that binds an order, unless the handler marks it [ValidateNever].
/// </summary>
public sealed class OrderRequest
{
    [Range(Min = 1)]
    public int CustomerId { get; set; }

    [Required]
    public string? Status { get; set; }

    [Required]
    [ItemCount(Min = 1)]
    [ValidateNested]
    public List<OrderLine>? Lines { get; set; }
}

public sealed class OrderLine
{
    [Range(Min = 1)]
    public int ProductId { get; set; }

    [Range(Min = 1)]
    public int Qty { get; set; }
}
// rb:end

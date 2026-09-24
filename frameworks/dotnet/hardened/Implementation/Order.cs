using ValidationModules.Constraints;

namespace Implementation;

/// <summary>
/// The body the bind rows send. It declares no constraint, because Hardened checks a handler's
/// body against every constraint its type declares, and the bind rows parse without validating.
/// </summary>
public sealed class OrderRequest
{
    public int CustomerId { get; set; }

    public string Status { get; set; } = "";

    public List<OrderLine> Lines { get; set; } = [];
}

public sealed class OrderLine
{
    public int ProductId { get; set; }

    public int Qty { get; set; }
}

// rb:wiring body.*
/// <summary>
/// The same body on the validate rows, with the rules orderRequest states. Hardened's validation
/// generator compiles the attributes into a check that runs after the body is bound and before
/// the handler.
/// </summary>
public sealed class ValidatedOrder
{
    [Range(Min = 1)]
    public int CustomerId { get; set; }

    [Required]
    public string Status { get; set; } = "";

    [Required]
    [ItemCount(Min = 1)]
    [ValidateNested]
    public List<ValidatedLine> Lines { get; set; } = [];
}

public sealed class ValidatedLine
{
    [Range(Min = 1)]
    public int ProductId { get; set; }

    [Range(Min = 1)]
    public int Qty { get; set; }
}
// rb:end

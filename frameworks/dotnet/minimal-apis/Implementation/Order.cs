using System.ComponentModel.DataAnnotations;

namespace Implementation;

// rb:wiring body.*
/// <summary>
/// The body the bind and validate rows send, carrying the rules orderRequest states as
/// DataAnnotations. The attributes do nothing on their own. AddValidation has minimal APIs
/// check them on every route that binds this type and has not opted out.
/// </summary>
public sealed class OrderRequest
{
    [Range(1, int.MaxValue)]
    public int CustomerId { get; set; }

    [Required]
    public string Status { get; set; } = "";

    [Required, MinLength(1)]
    public List<OrderLine> Lines { get; set; } = [];
}

public sealed class OrderLine
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(1, int.MaxValue)]
    public int Qty { get; set; }
}
// rb:end

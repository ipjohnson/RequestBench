using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Implementation;

// rb:wiring body.*
/// <summary>
/// The body the bind and validate rows send, with the rules orderRequest states written as
/// DataAnnotations, which MVC runs on every action that binds this type.
/// </summary>
public class OrderRequest
{
    [Range(1, int.MaxValue)]
    public int CustomerId { get; set; }

    [Required]
    public string Status { get; set; } = "";

    [Required]
    [MinLength(1)]
    public List<OrderLine> Lines { get; set; } = [];
}

public sealed class OrderLine
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(1, int.MaxValue)]
    public int Qty { get; set; }
}

/// <summary>
/// The same body, which MVC binds and does not validate. MVC reads [ValidateNever] from a type
/// or a property, and not from an action's own parameter, so the actions that skip validation
/// bind a type that carries it.
/// </summary>
[ValidateNever]
public sealed class UnvalidatedOrder : OrderRequest;
// rb:end

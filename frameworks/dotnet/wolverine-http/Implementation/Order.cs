using FluentValidation;

namespace Implementation;

/// <summary>The body the bind and validate rows send. The bind rows read it as this type, which has no validator.</summary>
public class OrderRequest
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

/// <summary>
/// The body on the two validate routes. Wolverine's FluentValidation middleware goes on every
/// endpoint whose request type has a validator, so the validated routes read a type of their own.
/// </summary>
public sealed class ValidatedOrder : OrderRequest;

/// <summary>The body on the route that stops at the first bad field, which has a validator of its own.</summary>
public sealed class FirstErrorOrder : OrderRequest;

// rb:wiring body.*
/// <summary>The rules orderRequest states, written once for both validators.</summary>
public abstract class OrderRules<T> : AbstractValidator<T> where T : OrderRequest
{
    protected OrderRules()
    {
        RuleFor(o => o.CustomerId).GreaterThan(0);
        RuleFor(o => o.Status).NotEmpty();
        RuleFor(o => o.Lines).NotEmpty();
        RuleForEach(o => o.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ProductId).GreaterThan(0);
            line.RuleFor(l => l.Qty).GreaterThan(0);
        });
    }
}

/// <summary>Every rule runs, so a body wrong in three fields names all three.</summary>
public sealed class OrderValidator : OrderRules<ValidatedOrder>;

/// <summary>Validation stops at the first rule that fails.</summary>
public sealed class FirstErrorValidator : OrderRules<FirstErrorOrder>
{
    public FirstErrorValidator() => ClassLevelCascadeMode = CascadeMode.Stop;
}
// rb:end

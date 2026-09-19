using FluentValidation;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// The order body, and the FluentValidation validator it pairs with.
///
/// Carter's validation runs FluentValidation validators. AddCarter finds this one, and the
/// endpoint filter behind MapPost&lt;OrderBody&gt; and MapPut&lt;OrderBody&gt; runs it before the
/// handler and answers 422 with its failures. The rules are declared once, here.
///
/// The properties are nullable so NotNull means present: an int is indistinguishable from
/// an absent one, because both arrive as zero.
/// </summary>
// rb:wiring body.*,domain.*
public sealed class OrderBody
{
    public int? CustomerId { get; set; }

    public string? Status { get; set; }

    public List<LineBody>? Lines { get; set; }

    /// <summary>The order, once the validator has said the body is one.</summary>
    public DomainModel.LineInput[] Input() =>
        [.. Lines!.Select(l => new DomainModel.LineInput(l.ProductId!.Value, l.Qty!.Value))];
}

public sealed class LineBody
{
    public int? ProductId { get; set; }

    public int? Qty { get; set; }
}

// rb:wiring body.*,domain.*
public sealed class OrderBodyValidator : AbstractValidator<OrderBody>
{
    public OrderBodyValidator()
    {
        RuleFor(x => x.CustomerId).NotNull();
        RuleFor(x => x.Status).NotNull();
        RuleFor(x => x.Lines).NotNull().Must(l => l is { Count: > 0 })
            .WithMessage("'Lines' must have at least one entry.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ProductId).NotNull();
            line.RuleFor(l => l.Qty).NotNull().GreaterThanOrEqualTo(1);
        });
    }
}

using FastEndpoints;
using FluentValidation;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// The order body as a FastEndpoints request, and the Validator it pairs with.
///
/// This is FastEndpoints' own validation facility: a Validator&lt;TRequest&gt; is discovered
/// and run against the bound request before the endpoint's handler is entered, and the
/// framework answers its own ErrorResponse itself when a rule fails. No handler calls a
/// validator. The rules underneath are FluentValidation, which FastEndpoints bundles.
///
/// The properties are nullable so NotNull means present: an int is indistinguishable from
/// an absent one, because both arrive as zero.
/// </summary>
// rb:wiring body.*,domain.*
public sealed class OrderRequest
{
    public int? CustomerId { get; set; }

    public string? Status { get; set; }

    public List<LineRequest>? Lines { get; set; }

    /// <summary>The order, once the validator has said the body is one.</summary>
    public DomainModel.LineInput[] Input() =>
        [.. Lines!.Select(l => new DomainModel.LineInput(l.ProductId!.Value, l.Qty!.Value))];
}

// rb:wiring body.*,domain.*
public sealed class LineRequest
{
    public int? ProductId { get; set; }

    public int? Qty { get; set; }
}

public sealed class OrderValidator : Validator<OrderRequest>
{
    public OrderValidator()
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

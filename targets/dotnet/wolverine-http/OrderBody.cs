using FluentValidation;
using RequestBench.Domain;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// The order body, and the FluentValidation validator Wolverine's middleware runs on it.
///
/// This is Wolverine's own validation facility: WolverineFx.Http.FluentValidation adds
/// middleware that discovers a validator for the request type and runs it before the
/// endpoint method is entered, answering a ValidationProblem itself when a rule fails. No
/// endpoint calls a validator, and the middleware is compiled into the handler rather than
/// reflected over at request time, which is how Wolverine does everything.
///
/// The properties are nullable so NotNull means present: an int is indistinguishable from
/// an absent one, because both arrive as zero.
/// </summary>
public sealed class OrderBody
{
    public int? CustomerId { get; set; }

    public string? Status { get; set; }

    public List<LineBody>? Lines { get; set; }

    /// <summary>The order, once the middleware's validator has said the body is one.</summary>
    public DomainModel.LineInput[] Input() =>
        [.. Lines!.Select(l => new DomainModel.LineInput(l.ProductId!.Value, l.Qty!.Value))];
}

public sealed class LineBody
{
    public int? ProductId { get; set; }

    public int? Qty { get; set; }
}

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

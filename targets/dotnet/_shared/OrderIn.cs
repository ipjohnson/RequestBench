using System.ComponentModel.DataAnnotations;

namespace RequestBench.Domain;

/// <summary>
/// The order body, annotated for System.ComponentModel.DataAnnotations.
///
/// The attributes are the declaration; which framework reads them is each target's
/// business. aspnet-mvc has MVC validate them on a [FromBody] parameter of an
/// [ApiController], and minimal-apis has AddValidation() do it. Nothing calls a validator
/// by hand in either.
///
/// The types are nullable so [Required] means present: an int is indistinguishable from an
/// absent one, because both arrive as zero.
///
/// It is in the shared project because DataAnnotations attributes are a declaration rather
/// than a validator, and two frameworks read the same declaration with their own machinery.
/// The frameworks that validate with FluentValidation declare their rules in their own
/// directories instead, where the validator that reads them lives.
/// </summary>
public sealed record OrderIn
{
    [Required]
    public int? CustomerId { get; init; }

    [Required]
    public string? Status { get; init; }

    [Required]
    [MinLength(1)]
    public List<LineIn>? Lines { get; init; }

    /// <summary>The order, once the framework's validator has said the body is one.</summary>
    public DomainModel.LineInput[] Input() =>
        [.. Lines!.Select(l => new DomainModel.LineInput(l.ProductId!.Value, l.Qty!.Value))];
}

public sealed record LineIn
{
    [Required]
    public int? ProductId { get; init; }

    [Required]
    [Range(1, int.MaxValue)]
    public int? Qty { get; init; }
}

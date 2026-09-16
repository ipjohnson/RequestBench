namespace RequestBench.Domain;

/// <summary>
/// The two failures a handler signals and never turns into a status itself, so the six
/// targets cannot drift on what a 404 or a 422 looks like.
/// </summary>
public sealed class NotFoundException : Exception
{
    public static readonly NotFoundException Instance = new();

    private NotFoundException() : base("not_found") { }
}

public sealed class ValidationException(IReadOnlyList<FieldError> errors) : Exception("validation failed")
{
    public IReadOnlyList<FieldError> Errors { get; } = errors;

    /// <summary>
    /// The 422 every target answers when the request body is not JSON at all. It is the
    /// same exception the validator raises so errors.malformed and body.rejected_* share a
    /// shape.
    /// </summary>
    public static ValidationException Malformed() =>
        new([new FieldError("body", "json")]);
}

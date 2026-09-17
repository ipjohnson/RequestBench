namespace RequestBench.Domain;

/// <summary>
/// The one failure a handler signals and never turns into a status itself, so the five
/// targets cannot drift on what a 404 looks like.
///
/// There is no validation signal here. A body a framework's own validator refused is that
/// framework's answer, raised and rendered where the framework raises it.
/// </summary>
public sealed class NotFoundException : Exception
{
    public static readonly NotFoundException Instance = new();

    private NotFoundException() : base("not_found") { }
}

/// <summary>
/// A request body that is not JSON at all. Not a validation failure: nothing validated it,
/// so it names no field, and each target answers it in its own envelope.
/// </summary>
public sealed class MalformedException(string detail) : Exception(detail);

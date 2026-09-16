using RequestBench.Domain;
using Wolverine.Attributes;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
///
/// Wolverine names middleware on the endpoint, which is the scoping the family needs.
/// Middleware added to the application would run on all forty-five endpoints. A layer is a
/// class with a Before, found by convention rather than by an interface; each one runs and
/// does nothing else.
/// </summary>
public static class Noop00
{
    public static void Before() { }
}

public static class Noop01
{
    public static void Before() { }
}

public static class Noop02
{
    public static void Before() { }
}

public static class Noop03
{
    public static void Before() { }
}

public static class Noop04
{
    public static void Before() { }
}

public static class Noop05
{
    public static void Before() { }
}

public static class Noop06
{
    public static void Before() { }
}

public static class Noop07
{
    public static void Before() { }
}

public static class Noop08
{
    public static void Before() { }
}

public static class Noop09
{
    public static void Before() { }
}

public static class Noop10
{
    public static void Before() { }
}

public static class Noop11
{
    public static void Before() { }
}

public static class Noop12
{
    public static void Before() { }
}

public static class Noop13
{
    public static void Before() { }
}

public static class Noop14
{
    public static void Before() { }
}

public static class Noop15
{
    public static void Before() { }
}

public static class MiddlewareEndpoints
{
    [WolverineGet("/middleware/none")]
    public static PayloadBody None(DomainModel domain) => domain.Payload("small");

    [WolverineGet("/middleware/four")]
    [Middleware(typeof(Noop00), typeof(Noop01), typeof(Noop02), typeof(Noop03))]
    public static PayloadBody Four(DomainModel domain) => domain.Payload("small");

    [WolverineGet("/middleware/sixteen")]
    [Middleware(typeof(Noop00), typeof(Noop01), typeof(Noop02), typeof(Noop03), typeof(Noop04), typeof(Noop05), typeof(Noop06), typeof(Noop07), typeof(Noop08), typeof(Noop09), typeof(Noop10), typeof(Noop11), typeof(Noop12), typeof(Noop13), typeof(Noop14), typeof(Noop15))]
    public static PayloadBody Sixteen(DomainModel domain) => domain.Payload("small");
}

using Microsoft.Extensions.DependencyInjection;

namespace RequestBench.Domain;

/// <summary>
/// How a target takes the domain: one call, one singleton, the same object in all six.
///
/// The alternative is a static class every target reaches into, which is what the other
/// languages do because they have nothing better. .NET does, and using it means a target
/// cannot quietly build its own copy of the domain: the model arrives through the
/// constructor, so a handler that did not ask for it has nothing to call.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Reads the fixture once and registers it. Called before the host is built, so a
    /// target that cannot read the fixture fails at startup rather than on the first
    /// request, which is what keeps the health probe from letting a broken target through.
    /// </summary>
    public static IServiceCollection AddRequestBenchDomain(
        this IServiceCollection services, string? fixturePath = null)
    {
        DomainModel model = DomainModel.Load(fixturePath ?? DomainModel.FixturePath());
        services.AddSingleton(model);
        return services;
    }
}

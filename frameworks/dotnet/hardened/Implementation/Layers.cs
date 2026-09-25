using Hardened.Requests.Abstract.Execution;
using Hardened.Requests.Abstract.RequestFilter;

namespace Implementation;

// rb:wiring middleware.*
/// <summary>
/// Puts <c>count</c> no-op filters on the handler it is written on. A filter attribute is how
/// Hardened attaches a layer to one route. Middleware would run on every request.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class LayersAttribute(int count) : Attribute, IRequestFilterProvider
{
    public IEnumerable<RequestFilterInfo> GetFilters(IExecutionRequestHandlerInfo handlerInfo)
    {
        for (int i = 0; i < count; i++)
        {
            yield return new RequestFilterInfo(_ => Noop.Instance, FilterOrder.DefaultValue, nameof(Noop));
        }
    }
}

/// <summary>A layer that calls the next and does nothing else.</summary>
public sealed class Noop : IExecutionFilter
{
    public static readonly Noop Instance = new();

    public Task Execute(IExecutionChain chain) => chain.Next();
}
// rb:end

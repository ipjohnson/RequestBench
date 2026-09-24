using Hardened.Requests.Abstract.Execution;
using Hardened.Requests.Abstract.RequestFilter;

namespace Implementation;

// rb:wiring middleware.*
/// <summary>
/// No-op filters in front of the handler it is written on, as many as it is given. A filter
/// attribute is the layer Hardened puts on one handler. A filter registered for every handler would
/// run on every route rather than on the middleware rows.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class LayersAttribute(int count) : Attribute, IRequestFilterProvider
{
    public int Count { get; } = count;

    public IEnumerable<RequestFilterInfo> GetFilters(IExecutionRequestHandlerInfo handlerInfo)
    {
        for (int i = 0; i < Count; i++)
        {
            yield return new RequestFilterInfo(_ => Noop.Instance, FilterOrder.DefaultValue, nameof(Noop));
        }
    }
}

/// <summary>Runs the rest of the chain and does nothing else.</summary>
public sealed class Noop : IExecutionFilter
{
    public static readonly Noop Instance = new();

    public Task Execute(IExecutionChain chain) => chain.Next();
}
// rb:end

using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// sse: items.medium's rows as server-sent events, through FastEndpoints' own event stream,
/// which serialises each item with its serializer options and flushes it as one event. Each row
/// goes out as a StreamItem named message, the type of an event that names none. The item
/// carries no id, so each event's id line is empty and a client keeps no last event id.
/// </summary>
// rb:handler sse.medium
public sealed class SseMediumEndpoint(Payloads payloads) : EndpointWithoutRequest
{
    public override void Configure() => Get("/sse/medium");

    public override Task HandleAsync(CancellationToken ct) =>
        Send.EventStreamAsync(payloads.Medium.Items.Select(row => new StreamItem("message", row)).ToAsyncEnumerable(), ct);
}

using System.Text.Json;
using System.Text.Json.Serialization;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc;

/// <summary>
/// System.Text.Json's source-generated metadata for every type the actions read or write.
/// With it first in MVC's resolver chain, the serializer reads the metadata from here
/// instead of building it by reflection the first time a type is read or written.
///
/// MVC's output formatter writes with a copy of these options that sets the relaxed
/// JavaScriptEncoder, because none is set here. System.Text.Json only runs a context's
/// generated fast path under the default encoder. So what reaches a request is the
/// metadata, through the same converters reflection would have used.
///
/// The parameter and header actions echo anonymous objects, which have no name to list
/// here. The reflection resolver that stays behind this one in the chain writes them.
/// </summary>
// rb:wiring json.*
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
[JsonSerializable(typeof(PayloadBody))]
[JsonSerializable(typeof(PayloadWithEcho))]
[JsonSerializable(typeof(QueryOne))]
[JsonSerializable(typeof(QueryMany))]
[JsonSerializable(typeof(JsonElement))]
[JsonSerializable(typeof(BindResult))]
[JsonSerializable(typeof(OrderIn))]
[JsonSerializable(typeof(ValidatedOrder))]
[JsonSerializable(typeof(Order))]
[JsonSerializable(typeof(OrdersPage))]
[JsonSerializable(typeof(JoinSummary))]
[JsonSerializable(typeof(Report))]
[JsonSerializable(typeof(Customer))]
internal sealed partial class JsonContext : JsonSerializerContext;

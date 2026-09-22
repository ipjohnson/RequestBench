using System.Text.Json;
using System.Text.Json.Serialization;
using FastEndpoints;

namespace Implementation;

// rb:wiring json.*
/// <summary>
/// System.Text.Json's source-generated metadata for every type read or written, first in
/// FastEndpoints' resolver chain, so no type's metadata is built by reflection on a request.
/// FastEndpoints' own ErrorResponse is here too, because the refusals are written through the
/// same options.
/// </summary>
[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(Payload))]
[JsonSerializable(typeof(Settings))]
[JsonSerializable(typeof(Item))]
[JsonSerializable(typeof(NewItem))]
[JsonSerializable(typeof(ReplacedItem))]
[JsonSerializable(typeof(ItemPatch))]
[JsonSerializable(typeof(OrderRequest))]
[JsonSerializable(typeof(CheckedOrder))]
[JsonSerializable(typeof(FirstErrorOrder))]
[JsonSerializable(typeof(Bound))]
[JsonSerializable(typeof(Echoed<ParametersOne>))]
[JsonSerializable(typeof(Echoed<ParametersTwo>))]
[JsonSerializable(typeof(Echoed<QueryOne>))]
[JsonSerializable(typeof(Echoed<Search>))]
[JsonSerializable(typeof(Echoed<HeadersBound>))]
[JsonSerializable(typeof(Uploaded))]
[JsonSerializable(typeof(Meta))]
[JsonSerializable(typeof(ErrorResponse))]
internal sealed partial class JsonContext : JsonSerializerContext;

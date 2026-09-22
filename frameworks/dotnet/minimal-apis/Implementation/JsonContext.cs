using System.Text.Json;
using System.Text.Json.Serialization;

namespace Implementation;

// rb:wiring json.*
/// <summary>
/// System.Text.Json's source-generated metadata for every type read or written, first in
/// minimal APIs' resolver chain, so no type's metadata is built by reflection on a request.
/// </summary>
[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(Payload))]
[JsonSerializable(typeof(Settings))]
[JsonSerializable(typeof(Item))]
[JsonSerializable(typeof(NewItem))]
[JsonSerializable(typeof(ItemPatch))]
[JsonSerializable(typeof(OrderRequest))]
[JsonSerializable(typeof(Bound))]
[JsonSerializable(typeof(Echoed<ParametersOne>))]
[JsonSerializable(typeof(Echoed<ParametersTwo>))]
[JsonSerializable(typeof(Echoed<QueryOne>))]
[JsonSerializable(typeof(Echoed<Search>))]
[JsonSerializable(typeof(Echoed<HeadersBound>))]
[JsonSerializable(typeof(Uploaded))]
[JsonSerializable(typeof(Meta))]
internal sealed partial class JsonContext : JsonSerializerContext;

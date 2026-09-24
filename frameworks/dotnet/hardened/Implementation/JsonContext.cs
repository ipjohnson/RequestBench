using System.Text.Json;
using System.Text.Json.Serialization;
using Hardened.Requests.Abstract.Errors;
using Hardened.Requests.Runtime.Validation;
using Hardened.Web.Runtime.Responses;

namespace Implementation;

// rb:wiring json.*
/// <summary>
/// System.Text.Json's source-generated metadata for every type read or written, which the module
/// registers as an IJsonTypeInfoResolver. Hardened's serializers ask it ahead of reflection. The
/// framework's own bodies are listed too, because lambda-emulator's native build has no
/// reflection to fall back on.
/// </summary>
[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(Payload))]
[JsonSerializable(typeof(Settings))]
[JsonSerializable(typeof(Item))]
[JsonSerializable(typeof(NewItem))]
[JsonSerializable(typeof(ItemPatch))]
[JsonSerializable(typeof(OrderRequest))]
[JsonSerializable(typeof(ValidatedOrder))]
[JsonSerializable(typeof(Bound<OrderRequest>))]
[JsonSerializable(typeof(Bound<ValidatedOrder>))]
[JsonSerializable(typeof(Echoed<ParametersOne>))]
[JsonSerializable(typeof(Echoed<ParametersTwo>))]
[JsonSerializable(typeof(Echoed<QueryOne>))]
[JsonSerializable(typeof(Echoed<Search>))]
[JsonSerializable(typeof(Echoed<HeadersBound>))]
[JsonSerializable(typeof(Uploaded))]
[JsonSerializable(typeof(Meta))]
[JsonSerializable(typeof(NotFound))]
[JsonSerializable(typeof(RequestValidationError))]
[JsonSerializable(typeof(ErrorModel))]
public sealed partial class JsonContext : JsonSerializerContext;

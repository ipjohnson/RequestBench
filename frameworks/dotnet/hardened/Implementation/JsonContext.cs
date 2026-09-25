using System.Text.Json;
using System.Text.Json.Serialization;
using Hardened.Requests.Abstract.Errors;
using Hardened.Requests.Runtime.Validation;
using Hardened.Web.Runtime.Responses;

namespace Implementation;

// rb:wiring json.*
/// <summary>
/// System.Text.Json's source-generated metadata for every type read or written, registered as an
/// IJsonTypeInfoResolver in ImplementationLibrary, where every serializer in Hardened's pipeline
/// asks it before reflection. lambda-emulator's native build has no reflection, so the list also
/// holds the bodies Hardened itself writes: the 404, the validation 400 and the error body.
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
[JsonSerializable(typeof(NotFound))]
[JsonSerializable(typeof(RequestValidationError))]
[JsonSerializable(typeof(ErrorModel))]
public sealed partial class JsonContext : JsonSerializerContext;

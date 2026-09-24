using System.Text.Json.Serialization;
using Amazon.Lambda.APIGatewayEvents;

namespace Implementation;

/// <summary>
/// System.Text.Json's source-generated metadata for the API Gateway payload format 2.0 event the
/// Lambda runtime client reads and the proxy response it posts back. On lambda-emulator the function
/// is a Native AOT build, where System.Text.Json builds no metadata by reflection, so
/// Amazon.Lambda.AspNetCoreServer reads and writes the events with this.
/// </summary>
[JsonSerializable(typeof(APIGatewayHttpApiV2ProxyRequest))]
[JsonSerializable(typeof(APIGatewayHttpApiV2ProxyResponse))]
internal sealed partial class LambdaJsonContext : JsonSerializerContext;

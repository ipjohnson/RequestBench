package rb.lambda;

import io.micronaut.function.aws.proxy.payload2.APIGatewayV2HTTPEventFunction;
import rb.domain.Domain;
import rb.hosts.Hosts;

/**
 * Host: lambda-rie, for Micronaut.
 *
 * Micronaut's own API Gateway v2 adapter, which is what people actually deploy, rather
 * than a generic shim over its HTTP server. Named rb.lambda.Handler like every other
 * target's entry, so one CMD in Dockerfile.lambda covers them all.
 */
public class Handler extends APIGatewayV2HTTPEventFunction {

  static {
    // Micronaut owns main under this host. Class initialisation happens once, before the
    // runtime constructs the handler, which keeps the fixture read out of the measured path.
    try {
      Domain.load(Hosts.fixture());
    } catch (Exception e) {
      throw new ExceptionInInitializerError(e);
    }
    Hosts.adapter("micronaut-function-aws-api-proxy");
    Hosts.serializer("jackson " + Hosts.version("jackson"));
  }
}

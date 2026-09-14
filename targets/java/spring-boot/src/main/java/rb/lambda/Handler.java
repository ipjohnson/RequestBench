package rb.lambda;

import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import java.io.InputStream;
import java.io.OutputStream;
import rb.domain.Domain;
import rb.hosts.Hosts;
import rb.spring.Main;

/**
 * Host: lambda-rie, for Spring Boot.
 *
 * aws-serverless-java-container is what people actually deploy in front of Spring Boot.
 * The stream form is used so the event is handed to the adapter as the raw payload it
 * models itself, rather than being converted through a second event type on the way in.
 *
 * Named rb.lambda.Handler like every other target's entry, so one CMD in Dockerfile.lambda
 * covers them all.
 */
public class Handler implements RequestStreamHandler {

  private final SpringBootLambdaContainerHandler<?, ?> delegate;

  public Handler() {
    try {
      Domain.load(Hosts.fixture());
      Hosts.adapter("aws-serverless-java-container", "aws-serverless-container");
      delegate = SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(Main.class);
    } catch (Exception e) {
      throw new IllegalStateException("boot", e);
    }
  }

  @Override
  public void handleRequest(InputStream in, OutputStream out, Context ctx) throws java.io.IOException {
    delegate.proxyStream(in, out, ctx);
  }
}

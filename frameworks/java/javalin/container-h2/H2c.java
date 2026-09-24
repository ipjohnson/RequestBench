package implementation;

import java.io.IOException;
import java.nio.file.Path;

import org.eclipse.jetty.http2.server.HTTP2CServerConnectionFactory;
import org.eclipse.jetty.server.HttpConnectionFactory;
import org.eclipse.jetty.server.ServerConnector;

/**
 * container-h2's start: the application on one Jetty connector that answers HTTP/2 with prior
 * knowledge. Javalin adds its own HTTP/1.1 connector only when none was added.
 */
public final class H2c {

    private H2c() {}

    public static void main(String[] args) throws IOException {
        Payloads payloads = Payloads.load(Path.of(System.getenv("RB_PAYLOADS")));
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        Application.create(payloads, config -> config.jetty.addConnector((server, http) -> {
            // The HTTP/1.1 factory sees the HTTP/2 preface a client with prior knowledge opens
            // with, and hands the connection to the h2c factory.
            ServerConnector connector = new ServerConnector(server, new HttpConnectionFactory(http), new HTTP2CServerConnectionFactory(http));
            connector.setPort(port);
            return connector;
        })).start();
    }
}

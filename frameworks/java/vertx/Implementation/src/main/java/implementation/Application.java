package implementation;

import implementation.routes.ContractRoutes;
import io.vertx.core.DeploymentOptions;
import io.vertx.core.Vertx;

/**
 * RequestBench target: Vert.x Web. One server verticle per core, each with a router over one
 * class per corpus family under routes/.
 */
public final class Application {

    private Application() {}

    public static void main(String[] args) throws Exception {
        Payloads payloads = Payloads.load(System.getenv("RB_PAYLOADS"));
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        Vertx vertx = Vertx.vertx();
        try {
            vertx.deployVerticle(() -> new Server(payloads, port),
                    new DeploymentOptions().setInstances(Runtime.getRuntime().availableProcessors())).await();
        } catch (RuntimeException failed) {
            // Vert.x's threads would keep the JVM running with nothing listening.
            vertx.close();
            throw failed;
        }
        ContractRoutes.listening();
    }
}

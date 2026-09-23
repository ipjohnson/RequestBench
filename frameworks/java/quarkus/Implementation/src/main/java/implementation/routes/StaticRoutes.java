package implementation.routes;

import implementation.Payloads;
import io.quarkus.runtime.StartupEvent;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.FileSystemAccess;
import io.vertx.ext.web.handler.StaticHandler;
import jakarta.enterprise.event.Observes;

/**
 * static: Vert.x's StaticHandler over the payload directory, under /static/, on the router Quarkus
 * serves, installed the way Quarkus's HTTP reference installs one. It sends a file with its length,
 * a type read from its extension and its modification time. quarkus.http.static-dir reads its
 * directory while the application is built and packages every file in it, so it would copy the
 * payloads into the build.
 */
public class StaticRoutes {

    // rb:handler static.file
    // rb:wiring static.*
    void installRoute(@Observes StartupEvent startupEvent, Router router, Payloads p) {
        router.route()
                .path("/static/*")
                .handler(StaticHandler.create(FileSystemAccess.ROOT, p.directory().toString()));
    }
}

package implementation.routes;

import implementation.Payloads;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.FileSystemAccess;
import io.vertx.ext.web.handler.StaticHandler;

/**
 * static: Vert.x Web's StaticHandler over the payload directory, under /static/. It sends a file
 * with its length, a type read from its extension, and its modification time. FileSystemAccess.ROOT
 * lets it serve a directory outside the working directory.
 */
public final class StaticRoutes {

    private StaticRoutes() {}

    public static void register(Router router, Payloads p) {
        // rb:handler static.file
        // rb:wiring static.*
        router.route("/static/*").handler(StaticHandler.create(FileSystemAccess.ROOT, p.directory()));
    }
}

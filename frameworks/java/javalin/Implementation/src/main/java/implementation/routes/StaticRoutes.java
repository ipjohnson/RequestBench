package implementation.routes;

import java.nio.file.Files;
import java.nio.file.Path;

import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Header;
import io.javalin.http.staticfiles.Location;
import org.eclipse.jetty.http.DateGenerator;

/**
 * static: Javalin's static-file handler over the payload directory, under /static. Javalin looks
 * for a file only when no route matches, and sends it with its type from the extension and a weak
 * ETag.
 */
public final class StaticRoutes {

    private final Payloads p;

    public StaticRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler static.file
    // rb:wiring static.*
    public void register(JavalinConfig config) {
        Path directory = p.directory();
        config.staticFiles.add(files -> {
            files.hostedPath = "/static";
            files.directory = directory.toString();
            files.location = Location.EXTERNAL;
            // Without it Javalin streams the file with no length, and Jetty sends it chunked once
            // it passes the 32 KB buffer. With it Javalin reads a file up to this size into memory
            // once, and sends it with its length.
            files.precompressMaxSize = 1 << 20;
        });
        // Javalin sends no Last-Modified for a file.
        config.routes.after("/static/*", ctx -> {
            if (ctx.statusCode() == 200) {
                Path file = directory.resolve(ctx.path().substring("/static/".length()));
                ctx.header(Header.LAST_MODIFIED, DateGenerator.formatDate(Files.getLastModifiedTime(file).toMillis()));
            }
        });
    }
}

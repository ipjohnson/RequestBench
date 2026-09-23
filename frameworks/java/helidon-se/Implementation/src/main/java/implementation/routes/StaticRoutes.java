package implementation.routes;

import java.nio.file.Path;

import io.helidon.webserver.staticcontent.StaticContentFeature;

/**
 * static: Helidon's StaticContentFeature over the payload directory, under /static. It sends a
 * file with its length, a type read from its extension, its modification time and an ETag made
 * from that time.
 */
public final class StaticRoutes {

    private StaticRoutes() {}

    // rb:handler static.file
    // rb:wiring static.*
    public static StaticContentFeature feature(Path payloads) {
        return StaticContentFeature.create(builder -> builder.addPath(path -> path.location(payloads).context("/static")));
    }
}

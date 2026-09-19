package rb.quarkus;

import io.smallrye.common.annotation.NonBlocking;
import jakarta.ws.rs.core.Application;

/**
 * Makes non-blocking the default for every resource method, so Quarkus REST calls each one on
 * the I/O thread that read the request. Without it a method returning a plain object is
 * dispatched to a worker thread. Nothing here blocks, and the methods returning a
 * TemplateInstance already ran on the I/O thread.
 *
 * It has no @ApplicationPath, so every path stays where it is.
 */
@NonBlocking
public class RestApplication extends Application {}

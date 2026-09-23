package implementation;

import io.smallrye.common.annotation.NonBlocking;
import jakarta.ws.rs.core.Application;

/**
 * RequestBench target: Quarkus. One resource class per corpus family under routes/.
 *
 * @NonBlocking here makes the I/O thread that read a request the default for every resource
 * method. Quarkus REST would otherwise run a method that returns a plain object on a worker
 * thread. No handler here blocks. The class names no @ApplicationPath, so every path stays as the
 * resources write it.
 */
@NonBlocking
public class RestApplication extends Application {}

package implementation;

import io.micronaut.runtime.Micronaut;

/**
 * RequestBench target: Micronaut. One controller per corpus family under routes/, which the
 * annotation processor turns into bean definitions at compile time.
 */
public class Application {

    public static void main(String[] args) {
        Micronaut.run(Application.class, args);
    }
}

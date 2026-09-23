package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.RequestFilter;
import io.micronaut.http.annotation.ServerFilter;

/**
 * middleware: no-op filters in front of the handler, four or sixteen of them. Each @RequestFilter
 * method is a filter of its own, which runs and lets the request go on, and its class's pattern
 * scopes it to its one path. Every other request pays the router's check of each filter's
 * pattern.
 */
@Controller
public class MiddlewareRoutes {

    private final Payloads p;

    MiddlewareRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/middleware/none")
    public Payload none() {
        return p.small();
    }

    // The filters below name these two paths too, so the handlers are marked.
    // rb:handler middleware.four
    @Get("/middleware/four")
    public Payload four() {
        return p.small();
    }

    // rb:handler middleware.sixteen
    @Get("/middleware/sixteen")
    public Payload sixteen() {
        return p.small();
    }

    // rb:wiring middleware.*
    @ServerFilter("/middleware/four")
    static final class FourLayers {

        @RequestFilter
        void layer1() {}

        @RequestFilter
        void layer2() {}

        @RequestFilter
        void layer3() {}

        @RequestFilter
        void layer4() {}
    }

    @ServerFilter("/middleware/sixteen")
    static final class SixteenLayers {

        @RequestFilter
        void layer1() {}

        @RequestFilter
        void layer2() {}

        @RequestFilter
        void layer3() {}

        @RequestFilter
        void layer4() {}

        @RequestFilter
        void layer5() {}

        @RequestFilter
        void layer6() {}

        @RequestFilter
        void layer7() {}

        @RequestFilter
        void layer8() {}

        @RequestFilter
        void layer9() {}

        @RequestFilter
        void layer10() {}

        @RequestFilter
        void layer11() {}

        @RequestFilter
        void layer12() {}

        @RequestFilter
        void layer13() {}

        @RequestFilter
        void layer14() {}

        @RequestFilter
        void layer15() {}

        @RequestFilter
        void layer16() {}
    }
    // rb:end
}

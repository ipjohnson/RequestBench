package implementation.routes;

import org.jboss.resteasy.reactive.server.ServerRequestFilter;

/**
 * The middleware layers: @ServerRequestFilter methods, each a request filter that Quarkus REST runs
 * before the handler. A filter that returns nothing lets the request go on, so each one passes the
 * request to the next and does nothing else. The name binding on each limits it to the routes that
 * carry the same one.
 */
// rb:wiring middleware.*
public class MiddlewareLayers {

    @ServerRequestFilter
    @MiddlewareRoutes.Four
    public void four1() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Four
    public void four2() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Four
    public void four3() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Four
    public void four4() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen1() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen2() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen3() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen4() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen5() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen6() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen7() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen8() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen9() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen10() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen11() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen12() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen13() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen14() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen15() {}

    @ServerRequestFilter
    @MiddlewareRoutes.Sixteen
    public void sixteen16() {}
}
// rb:end

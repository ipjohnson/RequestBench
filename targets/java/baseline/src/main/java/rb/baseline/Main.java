package rb.baseline;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.MultiThreadIoEventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioIoHandler;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.HttpUtil;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.QueryStringDecoder;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;
import rb.hosts.Hosts;

/**
 * RequestBench bare baseline for Java. No framework, no router library: Netty's HTTP codec
 * and nothing above it.
 *
 * Routing returns a transport-free Result (see Router), so the same routing serves every
 * host without one wrapping another. This class is the container host; GcpFunction and
 * LambdaHandler in this package are the other two, each calling Router.route directly
 * rather than translating another host's transport.
 */
public final class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    String host = Hosts.host();
    if (!Hosts.CONTAINER.equals(host)) {
      // The other hosts do not start a server; their entrypoints are named in the
      // Dockerfile for that host, so reaching here means the image and RB_HOST disagree.
      System.err.println("baseline: host " + host + " does not start an HTTP server");
      System.exit(2);
    }
    serve(Hosts.port());
  }

  static void serve(int port) throws InterruptedException {
    EventLoopGroup boss = new MultiThreadIoEventLoopGroup(1, NioIoHandler.newFactory());
    EventLoopGroup workers = new MultiThreadIoEventLoopGroup(NioIoHandler.newFactory());
    try {
      ServerBootstrap b = new ServerBootstrap();
      b.group(boss, workers)
       .channel(NioServerSocketChannel.class)
       .childOption(ChannelOption.TCP_NODELAY, true)
       .childHandler(new ChannelInitializer<SocketChannel>() {
         @Override
         protected void initChannel(SocketChannel ch) {
           ChannelPipeline p = ch.pipeline();
           p.addLast(new HttpServerCodec());
           p.addLast(new HttpObjectAggregator(1 << 20));
           p.addLast(new Handler());
         }
       });
      System.out.println("container/baseline listening on " + port);
      b.bind(port).sync().channel().closeFuture().sync();
    } finally {
      boss.shutdownGracefully();
      workers.shutdownGracefully();
    }
  }

  static final class Handler extends SimpleChannelInboundHandler<FullHttpRequest> {

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest req) {
      boolean keepAlive = HttpUtil.isKeepAlive(req);
      Result r;
      try {
        r = handle(req);
      } catch (Errors.Boom e) {
        r = Result.internal(e.getMessage());
      } catch (RuntimeException e) {
        r = Result.internal(e.getMessage() == null ? "internal" : e.getMessage());
      }
      write(ctx, r, keepAlive);
    }

    private static Result handle(FullHttpRequest req) {
      QueryStringDecoder url = new QueryStringDecoder(req.uri());
      String method = req.method().name();
      Map<String, Object> body = null;
      if (Router.hasBody(method) && req.content().isReadable()) {
        try {
          body = Json.body(req.content().toString(io.netty.util.CharsetUtil.UTF_8));
        } catch (Errors.Validation e) {
          return Result.validationFailed(e.errors());
        }
      }
      Map<String, List<String>> q = url.parameters();
      return Router.route(method, Router.split(url.path()), q, body);
    }

    private static void write(ChannelHandlerContext ctx, Result r, boolean keepAlive) {
      FullHttpResponse res = new DefaultFullHttpResponse(
          HttpVersion.HTTP_1_1, HttpResponseStatus.valueOf(r.status()),
          Unpooled.wrappedBuffer(r.body()));
      for (Map.Entry<String, String> h : r.headers().entrySet()) {
        res.headers().set(h.getKey(), h.getValue());
      }
      // 204 declares neither a type nor a length; everything else declares both, which is
      // the header contract conform.py enforces.
      if (r.status() != 204) {
        res.headers().set(HttpHeaderNames.CONTENT_LENGTH, r.body().length);
      }
      if (keepAlive) {
        res.headers().set(HttpHeaderNames.CONNECTION, "keep-alive");
        ctx.writeAndFlush(res, ctx.voidPromise());
      } else {
        ctx.writeAndFlush(res).addListener(io.netty.channel.ChannelFutureListener.CLOSE);
      }
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
      ctx.close();
    }
  }

  private Main() {}
}

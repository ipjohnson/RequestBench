package implementation.routes;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.util.Set;
import java.util.zip.Deflater;
import java.util.zip.GZIPOutputStream;

import implementation.Payloads;
import implementation.Serial;
import io.helidon.http.WritableHeaders;
import io.helidon.http.encoding.ContentDecoder;
import io.helidon.http.encoding.ContentEncoder;
import io.helidon.http.encoding.ContentEncoding;
import io.helidon.http.encoding.ContentEncodingContext;
import io.helidon.http.encoding.gzip.GzipEncoding;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * compressed: these routes answer like any other. The server's content encoding, which Main sets,
 * gzips the answer when the request asks for it.
 */
public final class CompressedRoutes implements HttpFeature {

    private final Payloads p;

    public CompressedRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/compressed/small", (req, res) -> {
            Serial.write(res);
            res.send(p.small());
        });

        routing.get("/compressed/large", (req, res) -> {
            Serial.write(res);
            res.send(p.large());
        });
    }

    // rb:wiring compressed.*
    /**
     * Helidon's content encoding, which belongs to the server's listener and so covers every route,
     * with gzip alone. GzipEncoding writes through a GZIPOutputStream at the JDK's default level
     * and has no setting for it, so FastestGzip replaces its encoder with one at the fastest level.
     */
    public static ContentEncodingContext encoding() {
        return ContentEncodingContext.builder()
                .contentEncodingsDiscoverServices(false)
                .addContentEncoding(new FastestGzip(GzipEncoding.create()))
                .build();
    }

    /** GzipEncoding with its encoder deflating at Deflater.BEST_SPEED. */
    private record FastestGzip(GzipEncoding gzip) implements ContentEncoding {

        @Override
        public ContentEncoder encoder() {
            ContentEncoder encoder = gzip.encoder();
            return new ContentEncoder() {
                @Override
                public OutputStream apply(OutputStream network) {
                    try {
                        return new GZIPOutputStream(network, true) {
                            {
                                def.setLevel(Deflater.BEST_SPEED);
                            }
                        };
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }

                @Override
                public void headers(WritableHeaders<?> headers) {
                    encoder.headers(headers);
                }
            };
        }

        @Override
        public ContentDecoder decoder() {
            return gzip.decoder();
        }

        @Override
        public Set<String> ids() {
            return gzip.ids();
        }

        @Override
        public boolean supportsEncoding() {
            return gzip.supportsEncoding();
        }

        @Override
        public boolean supportsDecoding() {
            return gzip.supportsDecoding();
        }

        @Override
        public String name() {
            return gzip.name();
        }

        @Override
        public String type() {
            return gzip.type();
        }
    }
    // rb:end
}

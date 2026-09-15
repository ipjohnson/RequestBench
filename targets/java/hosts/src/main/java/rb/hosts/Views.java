package rb.hosts;

import com.samskivert.mustache.Mustache;
import com.samskivert.mustache.Template;
import rb.domain.Model.PayloadBody;

/**
 * The one template engine every Java target renders with, and the one template.
 *
 * Pinned the way the gzip level is. An engine is a large constant factor, so six targets on
 * six engines would make template.small a comparison of engines with the framework
 * underneath it invisible.
 *
 * The keys are the record accessors rather than the JSON names, because the engine reflects
 * on the object and never sees the @JsonProperty on it. The spec pins the rendered content
 * and leaves whitespace free, so priceCents here and price_cents in the JSON describe the
 * same table.
 */
public final class Views {
  private Views() {}

  private static final String ITEMS =
      "<!doctype html>\n"
      + "<html>\n"
      + "  <head><title>items</title></head>\n"
      + "  <body>\n"
      + "    <h1>{{size}}</h1>\n"
      + "    <table>\n"
      + "      <thead>\n"
      + "        <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>\n"
      + "      </thead>\n"
      + "      <tbody>\n"
      + "        {{#items}}\n"
      + "        <tr>\n"
      + "          <td>{{id}}</td>\n"
      + "          <td>{{name}}</td>\n"
      + "          <td>{{category}}</td>\n"
      + "          <td>{{priceCents}}</td>\n"
      + "          <td>{{#inStock}}yes{{/inStock}}{{^inStock}}no{{/inStock}}</td>\n"
      + "        </tr>\n"
      + "        {{/items}}\n"
      + "      </tbody>\n"
      + "    </table>\n"
      + "    <p>{{count}} rows</p>\n"
      + "  </body>\n"
      + "</html>";

  /** Compiled once, rendered per request. A precomputed string would measure nothing. */
  private static final Template TEMPLATE = Mustache.compiler().escapeHTML(true).compile(ITEMS);

  public static String renderItems(PayloadBody body) {
    return TEMPLATE.execute(body);
  }
}

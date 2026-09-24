package implementation;

import io.micronaut.core.annotation.ReflectiveAccess;
import io.micronaut.serde.annotation.Serdeable;

/**
 * One row of items.large, and of every payload made from it. The template reads each row's
 * properties through Thymeleaf's OGNL, which uses reflection, so a native image has to keep them
 * reflectively accessible.
 */
@Serdeable
@ReflectiveAccess
public record Item(int id, String name, String category, int priceCents, boolean inStock) {}

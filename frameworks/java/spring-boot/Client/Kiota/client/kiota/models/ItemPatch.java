package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class ItemPatch implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The inStock property
     */
    private Boolean inStock;
    /**
     * The priceCents property
     */
    private Integer priceCents;
    /**
     * Instantiates a new {@link ItemPatch} and sets the default values.
     */
    public ItemPatch() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link ItemPatch}
     */
    @jakarta.annotation.Nonnull
    public static ItemPatch createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new ItemPatch();
    }
    /**
     * Gets the AdditionalData property value. Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     * @return a {@link Map<String, Object>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, Object> getAdditionalData() {
        return this.additionalData;
    }
    /**
     * The deserialization information for the current model
     * @return a {@link Map<String, java.util.function.Consumer<ParseNode>>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, java.util.function.Consumer<ParseNode>> getFieldDeserializers() {
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(2);
        deserializerMap.put("inStock", (n) -> { this.setInStock(n.getBooleanValue()); });
        deserializerMap.put("priceCents", (n) -> { this.setPriceCents(n.getIntegerValue()); });
        return deserializerMap;
    }
    /**
     * Gets the inStock property value. The inStock property
     * @return a {@link Boolean}
     */
    @jakarta.annotation.Nullable
    public Boolean getInStock() {
        return this.inStock;
    }
    /**
     * Gets the priceCents property value. The priceCents property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getPriceCents() {
        return this.priceCents;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeBooleanValue("inStock", this.getInStock());
        writer.writeIntegerValue("priceCents", this.getPriceCents());
        writer.writeAdditionalData(this.getAdditionalData());
    }
    /**
     * Sets the AdditionalData property value. Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     * @param value Value to set for the AdditionalData property.
     */
    public void setAdditionalData(@jakarta.annotation.Nullable final Map<String, Object> value) {
        this.additionalData = value;
    }
    /**
     * Sets the inStock property value. The inStock property
     * @param value Value to set for the inStock property.
     */
    public void setInStock(@jakarta.annotation.Nullable final Boolean value) {
        this.inStock = value;
    }
    /**
     * Sets the priceCents property value. The priceCents property
     * @param value Value to set for the priceCents property.
     */
    public void setPriceCents(@jakarta.annotation.Nullable final Integer value) {
        this.priceCents = value;
    }
}

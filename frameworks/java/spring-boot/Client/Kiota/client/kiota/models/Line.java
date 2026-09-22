package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class Line implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The productId property
     */
    private Integer productId;
    /**
     * The qty property
     */
    private Integer qty;
    /**
     * Instantiates a new {@link Line} and sets the default values.
     */
    public Line() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link Line}
     */
    @jakarta.annotation.Nonnull
    public static Line createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new Line();
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
        deserializerMap.put("productId", (n) -> { this.setProductId(n.getIntegerValue()); });
        deserializerMap.put("qty", (n) -> { this.setQty(n.getIntegerValue()); });
        return deserializerMap;
    }
    /**
     * Gets the productId property value. The productId property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getProductId() {
        return this.productId;
    }
    /**
     * Gets the qty property value. The qty property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getQty() {
        return this.qty;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeIntegerValue("productId", this.getProductId());
        writer.writeIntegerValue("qty", this.getQty());
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
     * Sets the productId property value. The productId property
     * @param value Value to set for the productId property.
     */
    public void setProductId(@jakarta.annotation.Nullable final Integer value) {
        this.productId = value;
    }
    /**
     * Sets the qty property value. The qty property
     * @param value Value to set for the qty property.
     */
    public void setQty(@jakarta.annotation.Nullable final Integer value) {
        this.qty = value;
    }
}

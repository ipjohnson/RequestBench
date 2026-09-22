package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class Two implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The one property
     */
    private Integer one;
    /**
     * The two property
     */
    private Integer two;
    /**
     * Instantiates a new {@link Two} and sets the default values.
     */
    public Two() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link Two}
     */
    @jakarta.annotation.Nonnull
    public static Two createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new Two();
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
        deserializerMap.put("one", (n) -> { this.setOne(n.getIntegerValue()); });
        deserializerMap.put("two", (n) -> { this.setTwo(n.getIntegerValue()); });
        return deserializerMap;
    }
    /**
     * Gets the one property value. The one property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getOne() {
        return this.one;
    }
    /**
     * Gets the two property value. The two property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getTwo() {
        return this.two;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeIntegerValue("one", this.getOne());
        writer.writeIntegerValue("two", this.getTwo());
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
     * Sets the one property value. The one property
     * @param value Value to set for the one property.
     */
    public void setOne(@jakarta.annotation.Nullable final Integer value) {
        this.one = value;
    }
    /**
     * Sets the two property value. The two property
     * @param value Value to set for the two property.
     */
    public void setTwo(@jakarta.annotation.Nullable final Integer value) {
        this.two = value;
    }
}

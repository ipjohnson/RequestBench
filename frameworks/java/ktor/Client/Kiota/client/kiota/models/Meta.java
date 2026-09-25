package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class Meta implements AdditionalDataHolder, Parsable {
    /**
     * The adapter property
     */
    private String adapter;
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The framework property
     */
    private String framework;
    /**
     * The runtime property
     */
    private String runtime;
    /**
     * The serializer property
     */
    private String serializer;
    /**
     * The version property
     */
    private String version;
    /**
     * Instantiates a new {@link Meta} and sets the default values.
     */
    public Meta() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link Meta}
     */
    @jakarta.annotation.Nonnull
    public static Meta createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new Meta();
    }
    /**
     * Gets the adapter property value. The adapter property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getAdapter() {
        return this.adapter;
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
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(5);
        deserializerMap.put("adapter", (n) -> { this.setAdapter(n.getStringValue()); });
        deserializerMap.put("framework", (n) -> { this.setFramework(n.getStringValue()); });
        deserializerMap.put("runtime", (n) -> { this.setRuntime(n.getStringValue()); });
        deserializerMap.put("serializer", (n) -> { this.setSerializer(n.getStringValue()); });
        deserializerMap.put("version", (n) -> { this.setVersion(n.getStringValue()); });
        return deserializerMap;
    }
    /**
     * Gets the framework property value. The framework property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getFramework() {
        return this.framework;
    }
    /**
     * Gets the runtime property value. The runtime property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getRuntime() {
        return this.runtime;
    }
    /**
     * Gets the serializer property value. The serializer property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getSerializer() {
        return this.serializer;
    }
    /**
     * Gets the version property value. The version property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getVersion() {
        return this.version;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeStringValue("adapter", this.getAdapter());
        writer.writeStringValue("framework", this.getFramework());
        writer.writeStringValue("runtime", this.getRuntime());
        writer.writeStringValue("serializer", this.getSerializer());
        writer.writeStringValue("version", this.getVersion());
        writer.writeAdditionalData(this.getAdditionalData());
    }
    /**
     * Sets the adapter property value. The adapter property
     * @param value Value to set for the adapter property.
     */
    public void setAdapter(@jakarta.annotation.Nullable final String value) {
        this.adapter = value;
    }
    /**
     * Sets the AdditionalData property value. Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     * @param value Value to set for the AdditionalData property.
     */
    public void setAdditionalData(@jakarta.annotation.Nullable final Map<String, Object> value) {
        this.additionalData = value;
    }
    /**
     * Sets the framework property value. The framework property
     * @param value Value to set for the framework property.
     */
    public void setFramework(@jakarta.annotation.Nullable final String value) {
        this.framework = value;
    }
    /**
     * Sets the runtime property value. The runtime property
     * @param value Value to set for the runtime property.
     */
    public void setRuntime(@jakarta.annotation.Nullable final String value) {
        this.runtime = value;
    }
    /**
     * Sets the serializer property value. The serializer property
     * @param value Value to set for the serializer property.
     */
    public void setSerializer(@jakarta.annotation.Nullable final String value) {
        this.serializer = value;
    }
    /**
     * Sets the version property value. The version property
     * @param value Value to set for the version property.
     */
    public void setVersion(@jakarta.annotation.Nullable final String value) {
        this.version = value;
    }
}

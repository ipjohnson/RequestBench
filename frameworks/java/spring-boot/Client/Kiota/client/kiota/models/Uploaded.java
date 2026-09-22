package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class Uploaded implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The echo property
     */
    private UploadEcho echo;
    /**
     * The file property
     */
    private UploadedFile file;
    /**
     * Instantiates a new {@link Uploaded} and sets the default values.
     */
    public Uploaded() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link Uploaded}
     */
    @jakarta.annotation.Nonnull
    public static Uploaded createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new Uploaded();
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
     * Gets the echo property value. The echo property
     * @return a {@link UploadEcho}
     */
    @jakarta.annotation.Nullable
    public UploadEcho getEcho() {
        return this.echo;
    }
    /**
     * The deserialization information for the current model
     * @return a {@link Map<String, java.util.function.Consumer<ParseNode>>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, java.util.function.Consumer<ParseNode>> getFieldDeserializers() {
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(2);
        deserializerMap.put("echo", (n) -> { this.setEcho(n.getObjectValue(UploadEcho::createFromDiscriminatorValue)); });
        deserializerMap.put("file", (n) -> { this.setFile(n.getObjectValue(UploadedFile::createFromDiscriminatorValue)); });
        return deserializerMap;
    }
    /**
     * Gets the file property value. The file property
     * @return a {@link UploadedFile}
     */
    @jakarta.annotation.Nullable
    public UploadedFile getFile() {
        return this.file;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeObjectValue("echo", this.getEcho());
        writer.writeObjectValue("file", this.getFile());
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
     * Sets the echo property value. The echo property
     * @param value Value to set for the echo property.
     */
    public void setEcho(@jakarta.annotation.Nullable final UploadEcho value) {
        this.echo = value;
    }
    /**
     * Sets the file property value. The file property
     * @param value Value to set for the file property.
     */
    public void setFile(@jakarta.annotation.Nullable final UploadedFile value) {
        this.file = value;
    }
}

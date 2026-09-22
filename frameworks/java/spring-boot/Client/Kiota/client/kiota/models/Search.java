package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class Search implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The category property
     */
    private String category;
    /**
     * The maxPrice property
     */
    private Integer maxPrice;
    /**
     * The minPrice property
     */
    private Integer minPrice;
    /**
     * The page property
     */
    private Integer page;
    /**
     * The q property
     */
    private String q;
    /**
     * The size property
     */
    private Integer size;
    /**
     * The sort property
     */
    private String sort;
    /**
     * The status property
     */
    private String status;
    /**
     * Instantiates a new {@link Search} and sets the default values.
     */
    public Search() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link Search}
     */
    @jakarta.annotation.Nonnull
    public static Search createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new Search();
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
     * Gets the category property value. The category property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getCategory() {
        return this.category;
    }
    /**
     * The deserialization information for the current model
     * @return a {@link Map<String, java.util.function.Consumer<ParseNode>>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, java.util.function.Consumer<ParseNode>> getFieldDeserializers() {
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(8);
        deserializerMap.put("category", (n) -> { this.setCategory(n.getStringValue()); });
        deserializerMap.put("maxPrice", (n) -> { this.setMaxPrice(n.getIntegerValue()); });
        deserializerMap.put("minPrice", (n) -> { this.setMinPrice(n.getIntegerValue()); });
        deserializerMap.put("page", (n) -> { this.setPage(n.getIntegerValue()); });
        deserializerMap.put("q", (n) -> { this.setQ(n.getStringValue()); });
        deserializerMap.put("size", (n) -> { this.setSize(n.getIntegerValue()); });
        deserializerMap.put("sort", (n) -> { this.setSort(n.getStringValue()); });
        deserializerMap.put("status", (n) -> { this.setStatus(n.getStringValue()); });
        return deserializerMap;
    }
    /**
     * Gets the maxPrice property value. The maxPrice property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getMaxPrice() {
        return this.maxPrice;
    }
    /**
     * Gets the minPrice property value. The minPrice property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getMinPrice() {
        return this.minPrice;
    }
    /**
     * Gets the page property value. The page property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getPage() {
        return this.page;
    }
    /**
     * Gets the q property value. The q property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getQ() {
        return this.q;
    }
    /**
     * Gets the size property value. The size property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getSize() {
        return this.size;
    }
    /**
     * Gets the sort property value. The sort property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getSort() {
        return this.sort;
    }
    /**
     * Gets the status property value. The status property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getStatus() {
        return this.status;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeStringValue("category", this.getCategory());
        writer.writeIntegerValue("maxPrice", this.getMaxPrice());
        writer.writeIntegerValue("minPrice", this.getMinPrice());
        writer.writeIntegerValue("page", this.getPage());
        writer.writeStringValue("q", this.getQ());
        writer.writeIntegerValue("size", this.getSize());
        writer.writeStringValue("sort", this.getSort());
        writer.writeStringValue("status", this.getStatus());
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
     * Sets the category property value. The category property
     * @param value Value to set for the category property.
     */
    public void setCategory(@jakarta.annotation.Nullable final String value) {
        this.category = value;
    }
    /**
     * Sets the maxPrice property value. The maxPrice property
     * @param value Value to set for the maxPrice property.
     */
    public void setMaxPrice(@jakarta.annotation.Nullable final Integer value) {
        this.maxPrice = value;
    }
    /**
     * Sets the minPrice property value. The minPrice property
     * @param value Value to set for the minPrice property.
     */
    public void setMinPrice(@jakarta.annotation.Nullable final Integer value) {
        this.minPrice = value;
    }
    /**
     * Sets the page property value. The page property
     * @param value Value to set for the page property.
     */
    public void setPage(@jakarta.annotation.Nullable final Integer value) {
        this.page = value;
    }
    /**
     * Sets the q property value. The q property
     * @param value Value to set for the q property.
     */
    public void setQ(@jakarta.annotation.Nullable final String value) {
        this.q = value;
    }
    /**
     * Sets the size property value. The size property
     * @param value Value to set for the size property.
     */
    public void setSize(@jakarta.annotation.Nullable final Integer value) {
        this.size = value;
    }
    /**
     * Sets the sort property value. The sort property
     * @param value Value to set for the sort property.
     */
    public void setSort(@jakarta.annotation.Nullable final String value) {
        this.sort = value;
    }
    /**
     * Sets the status property value. The status property
     * @param value Value to set for the status property.
     */
    public void setStatus(@jakarta.annotation.Nullable final String value) {
        this.status = value;
    }
}

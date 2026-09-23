package implementation

// Echoed is a payload with the values a handler bound written back beside its own fields.
type Echoed[T any] struct {
	*Payload
	Echo T `json:"echo"`
}

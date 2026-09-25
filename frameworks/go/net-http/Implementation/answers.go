package implementation

import (
	"encoding/json"
	"net/http"
)

// Echoed is a payload with the values a handler bound written back beside its own fields.
type Echoed[T any] struct {
	*Payload
	Echo T `json:"echo"`
}

// respond writes a value as JSON with encoding/json's encoder. net/http has no JSON writer.
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// refuse answers a request that could not be bound: 400, and the error's own text under error.
// http.Error would write the text as text/plain, and the corpus reads a refused body as JSON.
func refuse(w http.ResponseWriter, err error) {
	respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
}

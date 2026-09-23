package implementation

import (
	"net/http"

	"github.com/go-chi/render"
)

// Echoed is a payload with the values a handler bound written back beside its own fields.
type Echoed[T any] struct {
	*Payload
	Echo T `json:"echo"`
}

// ErrResponse is the renderer chi's REST example answers every error with, which render's
// README points to. It is the example's type as the example writes it.
type ErrResponse struct {
	Err            error `json:"-"` // low-level runtime error
	HTTPStatusCode int   `json:"-"` // http response status code

	StatusText string `json:"status"`          // user-level status message
	AppCode    int64  `json:"code,omitempty"`  // application-specific error code
	ErrorText  string `json:"error,omitempty"` // application-level error message, for debugging
}

func (e *ErrResponse) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, e.HTTPStatusCode)
	return nil
}

func ErrInvalidRequest(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: http.StatusBadRequest,
		StatusText:     "Invalid request.",
		ErrorText:      err.Error(),
	}
}

var ErrNotFound = &ErrResponse{HTTPStatusCode: http.StatusNotFound, StatusText: "Resource not found."}

// refuse answers a request that could not be bound as chi's REST example does: 400, with the
// error's own text.
func refuse(w http.ResponseWriter, r *http.Request, err error) {
	_ = render.Render(w, r, ErrInvalidRequest(err))
}

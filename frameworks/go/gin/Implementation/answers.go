package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Echoed is a payload with the values a handler bound written back beside its own fields.
type Echoed[T any] struct {
	*Payload
	Echo T `json:"echo"`
}

// refuse answers a request gin could not bind as gin's README does: 400 and the error's own text.
// Gin writes nothing for a failed ShouldBind, so this is the answer a gin application gives.
func refuse(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}

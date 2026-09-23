package implementation

import (
	"errors"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
)

// Echoed is a payload with the values a handler bound written back beside its own fields.
type Echoed[T any] struct {
	*Payload
	Echo T `json:"echo"`
}

// refuse answers a failed bind as step 4 of Fiber's validation guide does: a validation
// failure is 400 with the field and the rule of each error, and any other error is returned to
// Fiber's error handler.
func refuse(c fiber.Ctx, err error) error {
	var validationErrors validator.ValidationErrors
	if errors.As(err, &validationErrors) {
		out := make([]fiber.Map, 0, len(validationErrors))
		for _, e := range validationErrors {
			out = append(out, fiber.Map{
				"field": e.Field(),
				"rule":  e.Tag(),
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"errors": out})
	}
	return err
}

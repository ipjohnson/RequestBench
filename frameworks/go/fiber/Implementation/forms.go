package implementation

import (
	"mime/multipart"

	"github.com/gofiber/fiber/v3"
)

// Upload is forms.multipart's two fields and its file part.
type Upload struct {
	Tenant    string                `form:"tenant"`
	RequestID string                `form:"requestId"`
	File      *multipart.FileHeader `form:"file"`
}

type UploadedFile struct {
	Name  string `json:"name"`
	Bytes int64  `json:"bytes"`
}

type UploadEcho struct {
	Tenant    string `json:"tenant"`
	RequestID string `json:"requestId"`
}

type Uploaded struct {
	File UploadedFile `json:"file"`
	Echo UploadEcho   `json:"echo"`
}

// formsRoutes bind bodies that are not JSON with c.Bind().Form, which reads a urlencoded or a
// multipart body into the form tags, the file part as a *multipart.FileHeader. The urlencoded
// form binds query.many's fields.
func formsRoutes(app *fiber.App, p *Payloads) {
	app.Post("/forms/urlencoded", func(c fiber.Ctx) error {
		var form Search
		if err := c.Bind().Form(&form); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[Search]{&p.Small, form})
	})

	app.Post("/forms/multipart", func(c fiber.Ctx) error {
		var upload Upload
		if err := c.Bind().Form(&upload); err != nil {
			return refuse(c, err)
		}
		if upload.File == nil {
			return fiber.ErrBadRequest
		}
		return c.JSON(Uploaded{
			File: UploadedFile{Name: upload.File.Filename, Bytes: upload.File.Size},
			Echo: UploadEcho{Tenant: upload.Tenant, RequestID: upload.RequestID},
		})
	})
}

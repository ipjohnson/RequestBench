package implementation

import (
	"mime/multipart"
	"net/http"

	"github.com/labstack/echo/v5"
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

// formsRoutes bind bodies that are not JSON with c.Bind, which picks the form or the multipart
// parser from the Content-Type and fills the form tags. The urlencoded form binds query.many's
// fields.
func formsRoutes(e *echo.Echo, p *Payloads) {
	e.POST("/forms/urlencoded", func(c *echo.Context) error {
		var form Search
		if err := c.Bind(&form); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, Echoed[Search]{&p.Small, form})
	})

	e.POST("/forms/multipart", func(c *echo.Context) error {
		var upload Upload
		if err := c.Bind(&upload); err != nil {
			return err
		}
		if upload.File == nil {
			return echo.ErrBadRequest
		}
		return c.JSON(http.StatusOK, Uploaded{
			File: UploadedFile{Name: upload.File.Filename, Bytes: upload.File.Size},
			Echo: UploadEcho{Tenant: upload.Tenant, RequestID: upload.RequestID},
		})
	})
}

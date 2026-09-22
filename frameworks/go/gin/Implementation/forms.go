package implementation

import (
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Upload is forms.multipart's two fields and its file part.
type Upload struct {
	Tenant    string                `form:"tenant"`
	RequestID string                `form:"requestId"`
	File      *multipart.FileHeader `form:"file" binding:"required"`
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

// formsRoutes bind bodies that are not JSON with ShouldBind, which picks gin's form or multipart
// binding from the Content-Type and fills the form tags. The urlencoded form binds query.many's
// fields.
func formsRoutes(r *gin.Engine, p *Payloads) {
	r.POST("/forms/urlencoded", func(c *gin.Context) {
		var form Search
		if err := c.ShouldBind(&form); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Echoed[Search]{&p.Small, form})
	})

	r.POST("/forms/multipart", func(c *gin.Context) {
		var upload Upload
		if err := c.ShouldBind(&upload); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Uploaded{
			File: UploadedFile{Name: upload.File.Filename, Bytes: upload.File.Size},
			Echo: UploadEcho{Tenant: upload.Tenant, RequestID: upload.RequestID},
		})
	})
}

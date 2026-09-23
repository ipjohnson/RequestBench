package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

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

// formsRoutes read bodies that are not JSON with net/http's form parsing, which chi leaves
// as it is. The urlencoded form carries query.many's fields.
func formsRoutes(r chi.Router, p *Payloads) {
	r.Post("/forms/urlencoded", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			refuse(w, r, err)
			return
		}
		form, err := searchOf(r.PostForm)
		if err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, Echoed[Search]{&p.Small, form})
	})

	// FormFile parses the multipart body, holding up to 32 MB of it in memory.
	r.Post("/forms/multipart", func(w http.ResponseWriter, r *http.Request) {
		file, header, err := r.FormFile("file")
		if err != nil {
			refuse(w, r, err)
			return
		}
		_ = file.Close()
		render.JSON(w, r, Uploaded{
			File: UploadedFile{Name: header.Filename, Bytes: header.Size},
			Echo: UploadEcho{Tenant: r.FormValue("tenant"), RequestID: r.FormValue("requestId")},
		})
	})
}

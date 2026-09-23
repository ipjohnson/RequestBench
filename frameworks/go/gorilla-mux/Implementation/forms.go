package implementation

import (
	"net/http"

	"github.com/gorilla/mux"
)

// UploadFields is forms.multipart's two fields beside its file part.
type UploadFields struct {
	Tenant    string `schema:"tenant"`
	RequestID string `schema:"requestId"`
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

// formsRoutes parse bodies that are not JSON with net/http and decode the values with
// gorilla/schema, as schema's README decodes a form. The urlencoded form carries query.many's
// fields.
func formsRoutes(r *mux.Router, p *Payloads) {
	r.HandleFunc("/forms/urlencoded", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			refuse(w, err)
			return
		}
		var form Search
		if err := decoder.Decode(&form, r.PostForm); err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[Search]{&p.Small, form})
	}).Methods(http.MethodPost)

	r.HandleFunc("/forms/multipart", func(w http.ResponseWriter, r *http.Request) {
		// Up to 32 MB of the body is held in memory, as net/http's FormFile would hold it.
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			refuse(w, err)
			return
		}
		var fields UploadFields
		if err := decoder.Decode(&fields, r.MultipartForm.Value); err != nil {
			refuse(w, err)
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			refuse(w, err)
			return
		}
		_ = file.Close()
		respond(w, http.StatusOK, Uploaded{
			File: UploadedFile{Name: header.Filename, Bytes: header.Size},
			Echo: UploadEcho{Tenant: fields.Tenant, RequestID: fields.RequestID},
		})
	}).Methods(http.MethodPost)
}

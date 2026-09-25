package implementation

import "net/http"

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

// formsRoutes read bodies that are not JSON with net/http's form parsing. The urlencoded form
// carries query.many's fields, read as the query string is.
func formsRoutes(mux *http.ServeMux, p *Payloads) {
	mux.HandleFunc("POST /forms/urlencoded", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			refuse(w, err)
			return
		}
		search, err := searchOf(r.PostForm)
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[Search]{&p.Small, search})
	})

	mux.HandleFunc("POST /forms/multipart", func(w http.ResponseWriter, r *http.Request) {
		// FormFile parses the multipart body first, holding up to 32 MB of it in memory.
		file, header, err := r.FormFile("file")
		if err != nil {
			refuse(w, err)
			return
		}
		_ = file.Close()
		respond(w, http.StatusOK, Uploaded{
			File: UploadedFile{Name: header.Filename, Bytes: header.Size},
			Echo: UploadEcho{Tenant: r.PostFormValue("tenant"), RequestID: r.PostFormValue("requestId")},
		})
	})
}

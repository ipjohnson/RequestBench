package implementation

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
)

// FormInput is a urlencoded body as its raw bytes. Huma decodes a multipart form into a struct,
// and a urlencoded one into nothing.
type FormInput struct {
	RawBody []byte `contentType:"application/x-www-form-urlencoded"`
}

// UploadForm is forms.multipart's file part and its two fields, which Huma decodes by their form
// tags.
type UploadForm struct {
	File      huma.FormFile `form:"file" contentType:"text/plain" required:"true"`
	Tenant    string        `form:"tenant"`
	RequestID string        `form:"requestId"`
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

type UploadedOutput struct {
	Body Uploaded
}

// formsRoutes read bodies that are not JSON. The multipart form is Huma's MultipartFormFiles,
// and the urlencoded form carries query.many's fields, which the handler parses with net/url and
// converts with strconv.
func formsRoutes(api huma.API, p *Payloads) {
	huma.Post(api, "/forms/urlencoded", func(ctx context.Context, in *FormInput) (*EchoedOutput[Search], error) {
		values, err := url.ParseQuery(string(in.RawBody))
		if err != nil {
			return nil, huma.Error400BadRequest("the form does not parse", err)
		}
		search, err := searchOf(values)
		if err != nil {
			return nil, huma.Error422UnprocessableEntity("the form's numbers do not parse", err)
		}
		return &EchoedOutput[Search]{Body: Echoed[Search]{&p.Small, search}}, nil
	})

	huma.Post(api, "/forms/multipart", func(ctx context.Context, in *struct {
		RawBody huma.MultipartFormFiles[UploadForm]
	}) (*UploadedOutput, error) {
		form := in.RawBody.Data()
		_ = form.File.Close()
		return &UploadedOutput{Body: Uploaded{
			File: UploadedFile{Name: form.File.Filename, Bytes: form.File.Size},
			Echo: UploadEcho{Tenant: form.Tenant, RequestID: form.RequestID},
		}}, nil
	})
}

// searchOf reads query.many's eight values from a form.
func searchOf(values url.Values) (Search, error) {
	page, pageErr := number(values, "page")
	size, sizeErr := number(values, "size")
	minPrice, minErr := number(values, "minPrice")
	maxPrice, maxErr := number(values, "maxPrice")
	if err := errors.Join(pageErr, sizeErr, minErr, maxErr); err != nil {
		return Search{}, err
	}
	return Search{
		Page:     page,
		Size:     size,
		Status:   values.Get("status"),
		Category: values.Get("category"),
		Sort:     values.Get("sort"),
		Q:        values.Get("q"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
	}, nil
}

// number reads one value as an integer, and names the value when it is not one.
func number(values url.Values, name string) (int, error) {
	n, err := strconv.Atoi(values.Get(name))
	if err != nil {
		return 0, fmt.Errorf("%s: %w", name, err)
	}
	return n, nil
}

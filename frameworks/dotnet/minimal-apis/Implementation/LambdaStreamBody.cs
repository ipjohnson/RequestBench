using System.IO.Pipelines;
using System.Net;
using Amazon.Lambda.Core.ResponseStreaming;
using Microsoft.AspNetCore.Http.Features;

namespace Implementation;

/// <summary>
/// A response body that goes out as a Lambda response stream, opened at the first write with the
/// status and headers the response has by then. Once a stream is open, Lambda ignores the buffered
/// answer Amazon.Lambda.AspNetCoreServer returns for the invocation.
/// </summary>
public sealed class LambdaStreamBody(HttpResponse response) : Stream, IHttpResponseBodyFeature
{
    private LambdaResponseStream? _stream;
    private PipeWriter? _writer;

    private Stream Target => _stream ??= LambdaResponseStreamFactory.CreateHttpStream(Prelude());

    private HttpResponseStreamPrelude Prelude()
    {
        var prelude = new HttpResponseStreamPrelude { StatusCode = (HttpStatusCode)response.StatusCode };
        foreach (var (name, values) in response.Headers)
        {
            // A stream has no length, and Lambda frames it itself.
            if (name.Equals("Content-Length", StringComparison.OrdinalIgnoreCase)
                || name.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (name.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
            {
                foreach (string? cookie in values)
                {
                    prelude.Cookies.Add(cookie!);
                }
                continue;
            }
            prelude.Headers[name] = string.Join(", ", values.ToArray());
        }
        return prelude;
    }

    public Stream Stream => this;

    public PipeWriter Writer => _writer ??= PipeWriter.Create(this, new StreamPipeWriterOptions(leaveOpen: true));

    public void DisableBuffering() { }

    public Task StartAsync(CancellationToken cancellationToken = default) => Target.FlushAsync(cancellationToken);

    public Task SendFileAsync(string path, long offset, long? count, CancellationToken cancellationToken = default) =>
        SendFileFallback.SendFileAsync(this, path, offset, count, cancellationToken);

    /// <summary>Ends the stream, opening it first for an answer that wrote nothing.</summary>
    public async Task CompleteAsync()
    {
        if (_writer is not null)
        {
            await _writer.CompleteAsync();
        }
        await Target.FlushAsync();
        await Target.DisposeAsync();
    }

    public override bool CanRead => false;
    public override bool CanSeek => false;
    public override bool CanWrite => true;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    public override void Flush() => Target.Flush();
    public override Task FlushAsync(CancellationToken cancellationToken) => Target.FlushAsync(cancellationToken);
    public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => Target.Write(buffer, offset, count);
    public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        Target.WriteAsync(buffer, offset, count, cancellationToken);
    public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default) =>
        Target.WriteAsync(buffer, cancellationToken);
}

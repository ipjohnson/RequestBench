using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// items: every method on one resource over the rows of items.large. A measured row may not
/// leave the server changed, so the writes store nothing and answer as if they had written.
/// ASP.NET Core answers a method the path has no action for with 405 on its own.
/// </summary>
[ApiController]
public sealed class ItemsController(Payloads payloads) : ControllerBase
{
    // A GET route does not answer HEAD in ASP.NET Core, so the action names both, and Kestrel
    // leaves the body unwritten for HEAD.
    // rb:handler items.read,items.head
    // rb:handler errors.not_found
    [HttpGet("/items/{id:int}")]
    [HttpHead("/items/{id:int}")]
    public ActionResult<Item> Read(int id) => payloads.Row(id) is Item row ? row : NotFound();

    [HttpPost("/items")]
    public ActionResult<Item> Create(NewItem item)
    {
        Item created = item.At(payloads.Large.Count + 1);
        return CreatedAtAction(nameof(Read), new { id = created.Id }, created);
    }

    // rb:handler items.replace
    [HttpPut("/items/{id:int}")]
    public Item Replace(int id, NewItem item) => item.At(id);

    // rb:handler items.update
    [HttpPatch("/items/{id:int}")]
    public ActionResult<Item> Update(int id, ItemPatch patch) => payloads.Row(id) is Item row ? patch.Onto(row) : NotFound();

    // rb:handler items.delete
    [HttpDelete("/items/{id:int}")]
    public IActionResult Delete(int id) => payloads.Row(id) is null ? NotFound() : NoContent();
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Portfolio;
using SimuladorFinanciero.Api.Services;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("portfolios")]
[Authorize]
[Produces("application/json")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public sealed class PortfolioController : ControllerBase
{
    private readonly IPortfolioService _service;

    public PortfolioController(IPortfolioService service) => _service = service;

    private long GetUserId() =>
        long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? throw new InvalidOperationException("Token inválido: no contiene el claim sub."));

    // ── Portfolio CRUD ────────────────────────────────────────────────────────

    /// <summary>Lista todos los portfolios del usuario autenticado.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<PortfolioResumenResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPortfolios(CancellationToken ct) =>
        Ok(await _service.ObtenerPorUsuarioAsync(GetUserId(), ct));

    /// <summary>Detalle completo de un portfolio con todas sus tenencias.</summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType<PortfolioDetalleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPortfolio(long id, CancellationToken ct) =>
        Ok(await _service.ObtenerDetalleAsync(id, GetUserId(), ct));

    /// <summary>Crea un nuevo portfolio para el usuario autenticado.</summary>
    [HttpPost]
    [ProducesResponseType<PortfolioResumenResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreatePortfolio(CrearPortfolioRequest req, CancellationToken ct)
    {
        var portfolio = await _service.CrearAsync(GetUserId(), req, ct);
        return CreatedAtAction(nameof(GetPortfolio), new { id = portfolio.IdPortfolio }, portfolio);
    }

    /// <summary>Actualiza parcialmente los campos de un portfolio. Solo se modifican los campos enviados.</summary>
    [HttpPut("{id:long}")]
    [ProducesResponseType<PortfolioResumenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdatePortfolio(long id, ActualizarPortfolioRequest req, CancellationToken ct) =>
        Ok(await _service.ActualizarAsync(id, GetUserId(), req, ct));

    /// <summary>Elimina un portfolio y todas sus tenencias (CASCADE).</summary>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePortfolio(long id, CancellationToken ct)
    {
        await _service.EliminarAsync(id, GetUserId(), ct);
        return NoContent();
    }

    // ── Tenencias — Acciones ──────────────────────────────────────────────────

    /// <summary>Agrega una acción al portfolio. Solo una posición por acción (unicidad).</summary>
    [HttpPost("{id:long}/acciones")]
    [ProducesResponseType<PortfolioAccionResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AgregarAccion(long id, AgregarAccionRequest req, CancellationToken ct)
    {
        var tenencia = await _service.AgregarAccionAsync(id, GetUserId(), req, ct);
        return StatusCode(StatusCodes.Status201Created, tenencia);
    }

    /// <summary>Actualiza la cantidad y/o precio de compra de una acción en el portfolio.</summary>
    [HttpPut("{id:long}/acciones/{idAccion:long}")]
    [ProducesResponseType<PortfolioAccionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ActualizarAccion(long id, long idAccion, ActualizarAccionRequest req, CancellationToken ct) =>
        Ok(await _service.ActualizarAccionAsync(id, GetUserId(), idAccion, req, ct));

    /// <summary>Elimina la posición en una acción del portfolio.</summary>
    [HttpDelete("{id:long}/acciones/{idAccion:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> EliminarAccion(long id, long idAccion, CancellationToken ct)
    {
        await _service.EliminarAccionAsync(id, GetUserId(), idAccion, ct);
        return NoContent();
    }

    // ── Tenencias — Bonos ─────────────────────────────────────────────────────

    /// <summary>Agrega un bono al portfolio. Solo una posición por bono (unicidad).</summary>
    [HttpPost("{id:long}/bonos")]
    [ProducesResponseType<PortfolioBonoResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AgregarBono(long id, AgregarBonoRequest req, CancellationToken ct)
    {
        var tenencia = await _service.AgregarBonoAsync(id, GetUserId(), req, ct);
        return StatusCode(StatusCodes.Status201Created, tenencia);
    }

    /// <summary>Actualiza la cantidad y/o precio de compra de un bono en el portfolio.</summary>
    [HttpPut("{id:long}/bonos/{idBono:long}")]
    [ProducesResponseType<PortfolioBonoResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ActualizarBono(long id, long idBono, ActualizarBonoRequest req, CancellationToken ct) =>
        Ok(await _service.ActualizarBonoAsync(id, GetUserId(), idBono, req, ct));

    /// <summary>Elimina la posición en un bono del portfolio.</summary>
    [HttpDelete("{id:long}/bonos/{idBono:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> EliminarBono(long id, long idBono, CancellationToken ct)
    {
        await _service.EliminarBonoAsync(id, GetUserId(), idBono, ct);
        return NoContent();
    }

    // ── Tenencias — Letras ────────────────────────────────────────────────────

    /// <summary>Agrega una letra al portfolio. Solo una posición por letra (unicidad).</summary>
    [HttpPost("{id:long}/letras")]
    [ProducesResponseType<PortfolioLetraResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AgregarLetra(long id, AgregarLetraRequest req, CancellationToken ct)
    {
        var tenencia = await _service.AgregarLetraAsync(id, GetUserId(), req, ct);
        return StatusCode(StatusCodes.Status201Created, tenencia);
    }

    /// <summary>Actualiza la cantidad y/o precio de compra de una letra en el portfolio.</summary>
    [HttpPut("{id:long}/letras/{idLetra:long}")]
    [ProducesResponseType<PortfolioLetraResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ActualizarLetra(long id, long idLetra, ActualizarLetraRequest req, CancellationToken ct) =>
        Ok(await _service.ActualizarLetraAsync(id, GetUserId(), idLetra, req, ct));

    /// <summary>Elimina la posición en una letra del portfolio.</summary>
    [HttpDelete("{id:long}/letras/{idLetra:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> EliminarLetra(long id, long idLetra, CancellationToken ct)
    {
        await _service.EliminarLetraAsync(id, GetUserId(), idLetra, ct);
        return NoContent();
    }

    // ── Tenencias — Plazos Fijos ──────────────────────────────────────────────

    /// <summary>Agrega un plazo fijo al portfolio. Se permiten múltiples contratos del mismo tipo.</summary>
    [HttpPost("{id:long}/plazos-fijos")]
    [ProducesResponseType<PortfolioPlazoFijoResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AgregarPlazoFijo(long id, AgregarPlazoFijoRequest req, CancellationToken ct)
    {
        var tenencia = await _service.AgregarPlazoFijoAsync(id, GetUserId(), req, ct);
        return StatusCode(StatusCodes.Status201Created, tenencia);
    }

    /// <summary>Actualiza un contrato de plazo fijo específico del portfolio.</summary>
    [HttpPut("{id:long}/plazos-fijos/{idPlazoFijo:long}")]
    [ProducesResponseType<PortfolioPlazoFijoResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ActualizarPlazoFijo(long id, long idPlazoFijo, ActualizarPlazoFijoRequest req, CancellationToken ct) =>
        Ok(await _service.ActualizarPlazoFijoAsync(id, GetUserId(), idPlazoFijo, req, ct));

    /// <summary>Elimina un contrato de plazo fijo específico del portfolio.</summary>
    [HttpDelete("{id:long}/plazos-fijos/{idPlazoFijo:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> EliminarPlazoFijo(long id, long idPlazoFijo, CancellationToken ct)
    {
        await _service.EliminarPlazoFijoAsync(id, GetUserId(), idPlazoFijo, ct);
        return NoContent();
    }

    // ── Staleness de mercado (docs/09) ────────────────────────────────────────

    /// <summary>Refresca precio y tasa/parámetros GBM de todas las tenencias del portfolio contra el catálogo actual.</summary>
    [HttpPost("{id:long}/refrescar-mercado")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> RefrescarMercado(long id, CancellationToken ct)
    {
        await _service.RefrescarTenenciasMercadoAsync(id, GetUserId(), ct);
        return NoContent();
    }
}

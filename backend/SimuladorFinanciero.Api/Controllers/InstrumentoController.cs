using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("instrumentos")]
[Produces("application/json")]
public sealed class InstrumentoController : ControllerBase
{
    private readonly ILetraCatalogoService  _letras;
    private readonly IBonoCatalogoService   _bonos;
    private readonly IAccionCatalogoService _acciones;

    public InstrumentoController(
        ILetraCatalogoService  letras,
        IBonoCatalogoService   bonos,
        IAccionCatalogoService acciones)
    {
        _letras   = letras;
        _bonos    = bonos;
        _acciones = acciones;
    }

    // ── LETRAS ────────────────────────────────────────────────────────────────

    /// <summary>Lista todas las letras activas (LECAP y LECER) con precio vigente.</summary>
    [HttpGet("letras")]
    [ProducesResponseType<IReadOnlyList<LetraResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLetras(CancellationToken ct) =>
        Ok(await _letras.ObtenerActivasAsync(ct));

    /// <summary>Detalle de una letra por ID.</summary>
    [HttpGet("letras/{id:long}")]
    [ProducesResponseType<LetraResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLetra(long id, CancellationToken ct)
    {
        var letra = await _letras.ObtenerPorIdAsync(id, ct);
        return letra is null ? NotFound() : Ok(letra);
    }

    // ── BONOS ─────────────────────────────────────────────────────────────────

    /// <summary>Lista todos los bonos activos (tasa fija y CER) con sus flujos de caja.</summary>
    [HttpGet("bonos")]
    [ProducesResponseType<IReadOnlyList<BonoResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBonos(CancellationToken ct) =>
        Ok(await _bonos.ObtenerActivosAsync(ct));

    /// <summary>Detalle de un bono por ID, incluye flujos de caja.</summary>
    [HttpGet("bonos/{id:long}")]
    [ProducesResponseType<BonoResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBono(long id, CancellationToken ct)
    {
        var bono = await _bonos.ObtenerPorIdAsync(id, ct);
        return bono is null ? NotFound() : Ok(bono);
    }

    // ── ACCIONES ──────────────────────────────────────────────────────────────

    /// <summary>Lista todas las acciones activas con parámetros GBM (μ, σ, ρ).</summary>
    [HttpGet("acciones")]
    [ProducesResponseType<IReadOnlyList<AccionResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAcciones(CancellationToken ct) =>
        Ok(await _acciones.ObtenerActivasAsync(ct));

    /// <summary>Detalle de una acción por ID.</summary>
    [HttpGet("acciones/{id:long}")]
    [ProducesResponseType<AccionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAccion(long id, CancellationToken ct)
    {
        var accion = await _acciones.ObtenerPorIdAsync(id, ct);
        return accion is null ? NotFound() : Ok(accion);
    }
}

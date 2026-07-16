using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Referencia;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("referencia")]
[Authorize]
[Produces("application/json")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public sealed class ReferenciaController : ControllerBase
{
    private readonly IReferenciaRepository _repo;
    private readonly ITipoCambioService    _tipoCambio;

    public ReferenciaController(IReferenciaRepository repo, ITipoCambioService tipoCambio)
    {
        _repo       = repo;
        _tipoCambio = tipoCambio;
    }

    /// <summary>Lista las monedas soportadas (ARS, USD).</summary>
    [HttpGet("monedas")]
    [ProducesResponseType<IReadOnlyList<MonedaResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMonedas(CancellationToken ct) =>
        Ok(await _repo.ObtenerMonedasAsync(ct));

    /// <summary>Lista los perfiles de riesgo disponibles con su sigma máximo permitido.</summary>
    [HttpGet("perfiles-riesgo")]
    [ProducesResponseType<IReadOnlyList<PerfilRiesgoResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPerfilesRiesgo(CancellationToken ct) =>
        Ok(await _repo.ObtenerPerfilesRiesgoAsync(ct));

    /// <summary>Lista los tipos de escenario económico (FAVORABLE, MODERADO, DESFAVORABLE).</summary>
    [HttpGet("tipos-escenario")]
    [ProducesResponseType<IReadOnlyList<TipoEscenarioResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTiposEscenario(CancellationToken ct) =>
        Ok(await _repo.ObtenerTiposEscenarioAsync(ct));

    /// <summary>
    /// Lista los rangos de inflación mensual vigentes por escenario.
    /// Solo devuelve registros activos (vigente_hasta IS NULL o fecha futura).
    /// </summary>
    [HttpGet("escenarios-economicos")]
    [ProducesResponseType<IReadOnlyList<EscenarioEconomicoResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEscenariosEconomicos(CancellationToken ct) =>
        Ok(await _repo.ObtenerEscenariosVigentesAsync(ct));

    /// <summary>
    /// Cotización USD/ARS vigente y la fecha del registro del que salió (docs/09, sección 6: se aplica
    /// siempre en silencio para validar presupuesto — este endpoint solo expone el dato para que el
    /// frontend pueda mostrar cuán reciente es).
    /// </summary>
    [HttpGet("tipo-cambio")]
    [ProducesResponseType<TipoCambioResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetTipoCambio(CancellationToken ct)
    {
        var (valor, fecha) = await _tipoCambio.ObtenerCotizacionUsdArsAsync(ct);
        return Ok(new TipoCambioResponse(valor, fecha));
    }
}

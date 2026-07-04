using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Referencia;
using SimuladorFinanciero.Api.Repositories;

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

    public ReferenciaController(IReferenciaRepository repo) => _repo = repo;

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
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Simulacion;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("simulaciones")]
[Authorize]
[Produces("application/json")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public sealed class SimulacionController : ControllerBase
{
    private readonly ISimulacionRepository _repo;
    private readonly ISimulacionService    _svc;

    public SimulacionController(ISimulacionRepository repo, ISimulacionService svc)
    {
        _repo = repo;
        _svc  = svc;
    }

    private long GetUserId() =>
        long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? throw new InvalidOperationException("Token inválido: no contiene el claim sub."));

    /// <summary>
    /// Compara el estado original del portfolio con los precios de mercado actuales.
    /// Identifica instrumentos vencidos, actualizados o sin precio, e indica si la simulación puede ejecutarse.
    /// </summary>
    [HttpGet("/portfolios/{idPortfolio:long}/simular/preview")]
    [ProducesResponseType<SimulacionPreviewResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPreview(long idPortfolio, CancellationToken ct)
    {
        var preview = await _repo.ObtenerPreviewAsync(idPortfolio, GetUserId(), ct);
        return preview is null
            ? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.")
            : Ok(preview);
    }

    /// <summary>Ejecuta el motor de simulación Monte Carlo para el portfolio indicado y persiste los resultados.</summary>
    [HttpPost("/portfolios/{idPortfolio:long}/simular")]
    [ProducesResponseType<SimulacionResumenResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> Simular(
        long idPortfolio, [FromBody] SimularRequest req, CancellationToken ct)
    {
        var result = await _svc.SimularAsync(idPortfolio, GetUserId(), req, ct);
        return CreatedAtAction(nameof(GetDetalle), new { id = result.IdSimulacion }, result);
    }

    /// <summary>Lista el historial de simulaciones de un portfolio del usuario autenticado.</summary>
    [HttpGet("/portfolios/{idPortfolio:long}/simulaciones")]
    [ProducesResponseType<IReadOnlyList<SimulacionResumenResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPorPortfolio(long idPortfolio, CancellationToken ct) =>
        Ok(await _repo.ObtenerPorPortfolioAsync(idPortfolio, GetUserId(), ct));

    /// <summary>Devuelve la cabecera de una simulación: fecha, horizonte, seed y métricas agregadas.</summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType<SimulacionDetalleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetalle(long id, CancellationToken ct)
    {
        var detalle = await _repo.ObtenerDetalleAsync(id, GetUserId(), ct);
        return detalle is null
            ? throw new NotFoundException($"Simulación {id} no encontrada.")
            : Ok(detalle);
    }

    /// <summary>
    /// Devuelve los resultados estadísticos (stats JSONB) de una simulación.
    /// Filtrá por ámbito con ?ambito=portfolio_ars | portfolio_usd | accion_1 | etc.
    /// </summary>
    [HttpGet("{id:long}/resultados")]
    [ProducesResponseType<IReadOnlyList<ResultadoSimulacionResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetResultados(
        long id,
        [FromQuery] string? ambito,
        CancellationToken ct)
    {
        var existe = await _repo.ObtenerDetalleAsync(id, GetUserId(), ct);
        if (existe is null)
            throw new NotFoundException($"Simulación {id} no encontrada.");

        return Ok(await _repo.ObtenerResultadosAsync(id, GetUserId(), ambito, ct));
    }

    /// <summary>
    /// Devuelve los instrumentos de una simulación con su mes de vencimiento dentro del horizonte
    /// (si vence más allá del horizonte, o es una acción, o un plazo fijo con reinvertir=true, no
    /// hay vencimiento que marcar y viene null). Se usa para marcar en los gráficos el mes en que
    /// cada instrumento dejó de aportar crecimiento adicional.
    /// </summary>
    [HttpGet("{id:long}/instrumentos")]
    [ProducesResponseType<IReadOnlyList<InstrumentoSimulacionResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInstrumentos(long id, CancellationToken ct)
    {
        var existe = await _repo.ObtenerDetalleAsync(id, GetUserId(), ct);
        if (existe is null)
            throw new NotFoundException($"Simulación {id} no encontrada.");

        return Ok(await _repo.ObtenerInstrumentosAsync(id, GetUserId(), ct));
    }

    /// <summary>Elimina una simulación y sus datos asociados (resultados, instrumentos, trayectorias — CASCADE).</summary>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Eliminar(long id, CancellationToken ct)
    {
        if (!await _repo.EliminarAsync(id, GetUserId(), ct))
            throw new NotFoundException($"Simulación {id} no encontrada.");
        return NoContent();
    }
}

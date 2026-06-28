using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Byma;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Docta;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Api.Controllers;

/// <summary>
/// Endpoints de administración para disparar refrescos manuales del catálogo.
/// Requieren autenticación JWT.
/// </summary>
[ApiController]
[Route("admin/catalogo")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
public sealed class AdminController : ControllerBase
{
    private readonly ILetraCatalogoService  _letras;
    private readonly IBonoCatalogoService   _bonos;
    private readonly IAccionCatalogoService _acciones;
    private readonly IDoctaApiClient        _docta;
    private readonly IBymaApiClient         _byma;
    private readonly ILogger<AdminController> _log;

    public AdminController(
        ILetraCatalogoService  letras,
        IBonoCatalogoService   bonos,
        IAccionCatalogoService acciones,
        IDoctaApiClient        docta,
        IBymaApiClient         byma,
        ILogger<AdminController> log)
    {
        _letras   = letras;
        _bonos    = bonos;
        _acciones = acciones;
        _docta    = docta;
        _byma     = byma;
        _log      = log;
    }

    /// <summary>
    /// Verifica la conectividad con las APIs externas (BYMA y Docta Capital).
    /// No consume requests del catálogo — Docta solo obtiene token + 1 call mínima.
    /// </summary>
    [HttpGet("check")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Check(CancellationToken ct)
    {
        // BYMA: establece sesión (GET home, sin credenciales)
        bool bymaOk;
        string bymaDetalle;
        try
        {
            await _byma.ObtenerLetrasAsync(ct);
            bymaOk      = true;
            bymaDetalle = "Sesión establecida correctamente.";
        }
        catch (Exception ex)
        {
            bymaOk      = false;
            bymaDetalle = ex.Message;
        }

        // Docta Capital: token + 1 call al catálogo
        var (doctaOk, doctaDetalle) = await _docta.VerificarConexionAsync(ct);

        var todo = bymaOk && doctaOk;
        return todo ? Ok(new { ok = true,  byma = bymaDetalle, docta = doctaDetalle })
                    : StatusCode(502, new { ok = false, byma = bymaDetalle, docta = doctaDetalle });
    }

    /// <summary>Fuerza un refresco de precios y TNA de letras desde BYMA (+ LECER desde Docta).</summary>
    [HttpPost("refresh/letras")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshLetras(CancellationToken ct)
    {
        _log.LogInformation("Admin: refresco manual de letras solicitado por {User}.", User.Identity?.Name);
        await _letras.RefrescarPreciosAsync(ct);
        return Ok(new { mensaje = "Letras actualizadas." });
    }

    /// <summary>Fuerza un refresco de yields de bonos desde Docta Capital.</summary>
    [HttpPost("refresh/bonos/yields")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshBonosYields(CancellationToken ct)
    {
        _log.LogInformation("Admin: refresco manual de yields de bonos solicitado por {User}.", User.Identity?.Name);
        await _bonos.RefrescarYieldsAsync(ct);
        return Ok(new { mensaje = "Yields actualizados." });
    }

    /// <summary>
    /// Fuerza un refresco completo de flujos de caja de bonos desde Docta Capital.
    /// Operación lenta — puede tardar varios segundos.
    /// </summary>
    [HttpPost("refresh/bonos/flujos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshBonosFlujos(CancellationToken ct)
    {
        _log.LogInformation("Admin: refresco manual de flujos de bonos solicitado por {User}.", User.Identity?.Name);
        await _bonos.RefrescarFlujosCajaAsync(ct);
        return Ok(new { mensaje = "Flujos de caja actualizados." });
    }

    /// <summary>
    /// Recalcula los parámetros GBM (μ, σ, ρ, S₀) de todos los tickers activos.
    /// Operación lenta — puede tardar varios minutos por el rate limit de Alpha Vantage.
    /// </summary>
    [HttpPost("refresh/acciones")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshAcciones(CancellationToken ct)
    {
        _log.LogInformation("Admin: recálculo GBM para todas las acciones solicitado por {User}.", User.Identity?.Name);
        var resultados = await _acciones.RecalcularGbmTodosAsync(ct);
        return Ok(new { actualizadas = resultados.Count, resultados });
    }

    /// <summary>
    /// Recalcula los parámetros GBM (μ, σ, ρ, S₀) de una acción usando 10 años de historia de Alpha Vantage.
    /// Nombre y sector se leen desde DB (catálogo sembrado). Operación costosa — ejecutar semanalmente.
    /// </summary>
    [HttpPost("refresh/acciones/{ticker}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> RefreshAccion(string ticker, CancellationToken ct)
    {
        var t = ticker.Trim().ToUpperInvariant();
        _log.LogInformation("Admin: recálculo GBM para {Ticker} solicitado por {User}.", t, User.Identity?.Name);
        var resultado = await _acciones.RecalcularGbmAsync(t, ct);
        if (resultado is null)
            return UnprocessableEntity(new { mensaje = $"No se pudo calcular GBM para {t}: datos insuficientes o API no disponible." });
        return Ok(resultado);
    }
}

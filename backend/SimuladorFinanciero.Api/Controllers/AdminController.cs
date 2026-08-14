using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Referencia;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Byma;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Docta;
using SimuladorFinanciero.Api.Repositories;
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
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public sealed class AdminController : ControllerBase
{
    private readonly ILetraCatalogoService  _letras;
    private readonly IBonoCatalogoService   _bonos;
    private readonly IAccionCatalogoService _acciones;
    private readonly ITipoCambioService     _tipoCambio;
    private readonly IDoctaApiClient        _docta;
    private readonly IBymaApiClient         _byma;
    private readonly IReferenciaRepository  _referencia;
    private readonly ILogger<AdminController> _log;

    public AdminController(
        ILetraCatalogoService  letras,
        IBonoCatalogoService   bonos,
        IAccionCatalogoService acciones,
        ITipoCambioService     tipoCambio,
        IDoctaApiClient        docta,
        IBymaApiClient         byma,
        IReferenciaRepository  referencia,
        ILogger<AdminController> log)
    {
        _letras     = letras;
        _bonos      = bonos;
        _acciones   = acciones;
        _tipoCambio = tipoCambio;
        _docta      = docta;
        _byma       = byma;
        _referencia = referencia;
        _log        = log;
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

        return Ok(new
        {
            byma  = new { ok = bymaOk,  detalle = bymaDetalle },
            docta = new { ok = doctaOk, detalle = doctaDetalle },
        });
    }

    /// <summary>
    /// Estadísticas de uso de Docta para diagnosticar el límite de 120 rpm del plan: requests
    /// en la ventana deslizante del último minuto y conteo de 429 recibidos desde que arrancó
    /// el proceso. Disparar un refresh manual (letras/yields/flujos) y consultar esto enseguida
    /// después muestra el pico real de esa corrida.
    /// </summary>
    [HttpGet("docta-rate-limit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult DoctaRateLimit()
    {
        return Ok(_docta.ObtenerEstadisticasRateLimit());
    }

    /// <summary>Fuerza un refresco de precios y TNA de letras desde BYMA (+ LECER desde Docta).</summary>
    [HttpPost("refresh/letras")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshLetras(CancellationToken ct)
    {
        _log.LogInformation("Admin: refresco manual de letras solicitado por {User}.", User.Identity?.Name);
        var actualizadas = await _letras.RefrescarPreciosAsync(ct);
        return Ok(new
        {
            actualizadas,
            mensaje = actualizadas > 0
                ? $"Se actualizaron {actualizadas} letras."
                : "No se actualizó ninguna letra: BYMA no devolvió datos (probablemente fuera de horario de mercado) o Docta no tenía yield disponible para ninguna.",
        });
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

    /// <summary>Fuerza una consulta live al BCRA de la cotización USD/ARS (ignora el valor ya cacheado del día).</summary>
    [HttpPost("refresh/tipo-cambio")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> RefreshTipoCambio(CancellationToken ct)
    {
        _log.LogInformation("Admin: refresco manual de cotización USD/ARS (BCRA) solicitado por {User}.", User.Identity?.Name);
        var valor = await _tipoCambio.RefrescarAsync(ct);
        return Ok(new { mensaje = "Cotización USD/ARS actualizada.", cotizacionUsdArs = valor });
    }

    /// <summary>
    /// Actualiza los rangos de inflación mensual vigentes por escenario económico (Favorable/Moderado/Desfavorable).
    /// Versiona el cambio: cierra el rango vigente actual y abre uno nuevo, solo para los escenarios que
    /// realmente cambiaron. No afecta simulaciones ya corridas, que leen su propio snapshot.
    /// </summary>
    [HttpPut("/admin/escenarios-economicos")]
    [ProducesResponseType<IReadOnlyList<EscenarioEconomicoResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ActualizarEscenariosEconomicos(ActualizarEscenariosEconomicosRequest req, CancellationToken ct)
    {
        if (req.Escenarios.Count == 0)
            throw new ValidationException("Debe incluir al menos un escenario.");

        foreach (var item in req.Escenarios)
        {
            if (item.InflacionMensualMin > item.InflacionMensualMax)
                throw new ValidationException($"Escenario {item.IdTipoEscenario}: la inflación mensual mínima no puede ser mayor a la máxima.");
            if (item.InflacionMensualMinUsd > item.InflacionMensualMaxUsd)
                throw new ValidationException($"Escenario {item.IdTipoEscenario}: la inflación mensual mínima (USD) no puede ser mayor a la máxima (USD).");
        }

        _log.LogInformation("Admin: actualización manual de rangos de inflación solicitada por {User}.", User.Identity?.Name);
        await _referencia.ActualizarEscenariosVigentesAsync(req.Escenarios, ct);
        return Ok(await _referencia.ObtenerEscenariosVigentesAsync(ct));
    }
}

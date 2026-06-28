using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Api.Services.BackgroundJobs;

/// <summary>
/// Job diario que actualiza el catálogo de instrumentos una vez por día hábil,
/// 30 minutos después de la apertura bursátil (configurable vía CatalogoRefresh:HoraEjecucionArt).
/// Orden: letras → bonos yields → bonos flujos → acciones GBM.
/// </summary>
public sealed class CatalogoRefreshJob : BackgroundService
{
    private static readonly TimeZoneInfo Tz =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    private readonly ILetraCatalogoService  _letras;
    private readonly IBonoCatalogoService   _bonos;
    private readonly IAccionCatalogoService _acciones;
    private readonly IConfiguration         _config;
    private readonly ILogger<CatalogoRefreshJob> _log;

    public CatalogoRefreshJob(
        ILetraCatalogoService  letras,
        IBonoCatalogoService   bonos,
        IAccionCatalogoService acciones,
        IConfiguration         config,
        ILogger<CatalogoRefreshJob> log)
    {
        _letras   = letras;
        _bonos    = bonos;
        _acciones = acciones;
        _config   = config;
        _log      = log;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_config.GetValue("CatalogoRefresh:Habilitado", true))
        {
            _log.LogInformation("CatalogoRefreshJob deshabilitado por configuración (CatalogoRefresh:Habilitado=false).");
            return Task.CompletedTask;
        }

        return EjecutarLoopAsync(stoppingToken);
    }

    private async Task EjecutarLoopAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var demora = TiempoHastaProximaEjecucion();
            _log.LogInformation(
                "CatalogoRefreshJob: próxima actualización en {Horas:F1} horas ({Hora} ART).",
                demora.TotalHours,
                (TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz) + demora).ToString("dd/MM HH:mm"));

            await Task.Delay(demora, stoppingToken);

            if (stoppingToken.IsCancellationRequested) break;

            _log.LogInformation("CatalogoRefreshJob: iniciando actualización diaria del catálogo.");

            await EjecutarSeguroAsync(() => _letras.RefrescarPreciosAsync(stoppingToken),        "letras precios",  stoppingToken);
            await EjecutarSeguroAsync(() => _bonos.RefrescarYieldsAsync(stoppingToken),          "bonos yields",    stoppingToken);
            await EjecutarSeguroAsync(() => _bonos.RefrescarFlujosCajaAsync(stoppingToken),      "bonos flujos",    stoppingToken);
            await EjecutarSeguroAsync(() => _acciones.RecalcularGbmTodosAsync(stoppingToken),    "acciones GBM",    stoppingToken);

            _log.LogInformation("CatalogoRefreshJob: actualización diaria completada.");
        }
    }

    /// <summary>
    /// Calcula el tiempo hasta la próxima ejecución. Si la hora ya pasó hoy,
    /// programa para el próximo día hábil (lunes a viernes).
    /// </summary>
    private TimeSpan TiempoHastaProximaEjecucion()
    {
        var horaStr = _config.GetValue("CatalogoRefresh:HoraEjecucionArt", "11:30") ?? "11:30";
        var hora    = TimeOnly.Parse(horaStr);

        var ahoraArt    = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz);
        var candidata   = ahoraArt.Date.Add(hora.ToTimeSpan());

        // Si la hora de hoy ya pasó, empezar desde mañana
        if (ahoraArt >= candidata)
            candidata = candidata.AddDays(1);

        // Avanzar hasta el próximo día hábil (saltar fines de semana)
        while (candidata.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            candidata = candidata.AddDays(1);

        // Convertir de vuelta a UTC para calcular la diferencia
        var candidataUtc = TimeZoneInfo.ConvertTimeToUtc(candidata, Tz);
        return candidataUtc - DateTime.UtcNow;
    }

    private async Task EjecutarSeguroAsync(Func<Task> tarea, string nombre, CancellationToken ct)
    {
        try
        {
            await tarea();
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Apagado normal
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "CatalogoRefreshJob: error en '{Nombre}'.", nombre);
        }
    }
}

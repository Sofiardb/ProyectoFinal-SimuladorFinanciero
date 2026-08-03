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
        _log.LogInformation("CatalogoRefreshJob: servicio iniciado.");

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

            var pausaEntrePasos = TimeSpan.FromSeconds(
                _config.GetValue("CatalogoRefresh:PausaEntrePasosSegundos", 120));

            await EjecutarSeguroAsync(() => _letras.RefrescarPreciosAsync(stoppingToken),        "letras precios",  stoppingToken);
            await PausarAsync(pausaEntrePasos, stoppingToken);
            await EjecutarSeguroAsync(() => _bonos.RefrescarYieldsAsync(stoppingToken),          "bonos yields",    stoppingToken);
            await PausarAsync(pausaEntrePasos, stoppingToken);
            await EjecutarSeguroAsync(() => _bonos.RefrescarFlujosCajaAsync(stoppingToken),      "bonos flujos",    stoppingToken);
            await PausarAsync(pausaEntrePasos, stoppingToken);
            await EjecutarSeguroAsync(() => _acciones.RecalcularGbmTodosAsync(stoppingToken),    "acciones GBM",    stoppingToken);

            _log.LogInformation("CatalogoRefreshJob: actualización diaria completada.");
        }
    }

    private TimeSpan TiempoHastaProximaEjecucion()
    {
        var horaStr = _config.GetValue("CatalogoRefresh:HoraEjecucionArt", "11:30") ?? "11:30";
        return CalcularDemora(DateTime.UtcNow, TimeOnly.Parse(horaStr), Tz);
    }

    /// <summary>
    /// Calcula el tiempo hasta la próxima ejecución dado un instante UTC.
    /// Si la hora ya pasó hoy, programa para el próximo día hábil (lunes a viernes).
    /// </summary>
    internal static TimeSpan CalcularDemora(DateTime ahoraUtc, TimeOnly hora, TimeZoneInfo tz)
    {
        var ahoraLocal  = TimeZoneInfo.ConvertTimeFromUtc(ahoraUtc, tz);
        var candidata   = ahoraLocal.Date.Add(hora.ToTimeSpan());

        if (ahoraLocal >= candidata)
            candidata = candidata.AddDays(1);

        while (candidata.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            candidata = candidata.AddDays(1);

        return TimeZoneInfo.ConvertTimeToUtc(candidata, tz) - ahoraUtc;
    }

    /// <summary>
    /// Espacia los pasos del refresh diario (letras → bonos yields → bonos flujos → acciones) para
    /// no acumular en una misma ventana de rpm los requests de dos pasos consecutivos contra Docta
    /// (plan de 120 rpm). Configurable vía CatalogoRefresh:PausaEntrePasosSegundos (default 120s);
    /// no aplica a los refrescos manuales de /admin/catalogo, que siguen siendo instantáneos.
    /// </summary>
    private async Task PausarAsync(TimeSpan duracion, CancellationToken ct)
    {
        _log.LogInformation("CatalogoRefreshJob: pausa de {Segundos:F0}s antes del próximo paso (rate limit Docta).",
            duracion.TotalSeconds);
        try
        {
            await Task.Delay(duracion, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Apagado normal
        }
    }

    private async Task EjecutarSeguroAsync(Func<Task> tarea, string nombre, CancellationToken ct)
    {
        var cronometro = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await tarea();
            _log.LogInformation("CatalogoRefreshJob: '{Nombre}' OK ({Ms} ms).", nombre, cronometro.ElapsedMilliseconds);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Apagado normal
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "CatalogoRefreshJob: error en '{Nombre}' ({Ms} ms).", nombre, cronometro.ElapsedMilliseconds);
        }
    }
}

using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Api.Services.BackgroundJobs;

public sealed class CatalogoRefreshJob : BackgroundService
{
    // Zona horaria de Argentina (UTC-3, sin cambio de horario)
    private static readonly TimeZoneInfo Tz =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    private static readonly TimeOnly AperturaArt = new(11, 0);
    private static readonly TimeOnly CierreArt   = new(17, 0);

    private readonly ILetraCatalogoService  _letras;
    private readonly IBonoCatalogoService   _bonos;
    private readonly IAccionCatalogoService _acciones;
    private readonly IConfiguration         _config;
    private readonly ILogger<CatalogoRefreshJob> _log;

    private DateTime _ultimaActFlujos = DateTime.MinValue;
    private DateTime _ultimaActGbm    = DateTime.MinValue;

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

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalMin = _config.GetValue("CatalogoRefresh:IntervalMinutos", 15);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMin));

        _log.LogInformation("CatalogoRefreshJob iniciado. Intervalo: {Min} min.", intervalMin);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (!EsDentroHorarioBursatil())
            {
                _log.LogDebug("CatalogoRefreshJob: fuera de horario bursátil, se omite el ciclo.");
                continue;
            }

            _log.LogInformation("CatalogoRefreshJob: iniciando ciclo de actualización.");

            // Precios y yields — cada 15 min en horario bursátil
            await EjecutarSeguroAsync(() => _letras.RefrescarPreciosAsync(stoppingToken), "letras", stoppingToken);
            await EjecutarSeguroAsync(() => _bonos.RefrescarYieldsAsync(stoppingToken),  "bonos yields", stoppingToken);

            // Flujos de caja — una vez cada 24 hs
            if ((DateTime.UtcNow - _ultimaActFlujos).TotalHours >= 24)
            {
                await EjecutarSeguroAsync(() => _bonos.RefrescarFlujosCajaAsync(stoppingToken), "bonos flujos", stoppingToken);
                _ultimaActFlujos = DateTime.UtcNow;
            }

            // Parámetros GBM de acciones — una vez por semana
            if ((DateTime.UtcNow - _ultimaActGbm).TotalDays >= 7)
            {
                await EjecutarSeguroAsync(() => _acciones.RecalcularGbmTodosAsync(stoppingToken), "acciones GBM", stoppingToken);
                _ultimaActGbm = DateTime.UtcNow;
            }
        }
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

    private static bool EsDentroHorarioBursatil()
    {
        var ahoraArt = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz);
        var ahora    = TimeOnly.FromDateTime(ahoraArt);
        return ahoraArt.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday
            && ahora >= AperturaArt
            && ahora <= CierreArt;
    }
}

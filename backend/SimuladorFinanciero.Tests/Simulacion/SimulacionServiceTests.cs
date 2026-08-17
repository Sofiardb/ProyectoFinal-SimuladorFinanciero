using System.Data;
using System.Text.Json;
using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using NSubstitute.ReturnsExtensions;
using SimuladorFinanciero.Api.DTOs.Simulacion;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services;

namespace SimuladorFinanciero.Tests.Simulacion;

public class SimulacionServiceTests
{
    private readonly IPortfolioRepository  _portfolioRepo;
    private readonly ISimulacionRepository _simRepo;
    private readonly IMotorClientService   _motor;
    private readonly SimulacionService     _svc;

    private const long IdUsuario   = 42;
    private const long IdPortfolio = 1;

    public SimulacionServiceTests()
    {
        _portfolioRepo = Substitute.For<IPortfolioRepository>();
        _simRepo       = Substitute.For<ISimulacionRepository>();
        _motor         = Substitute.For<IMotorClientService>();
        _svc           = new SimulacionService(_portfolioRepo, _simRepo, _motor);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Portfolio PortfolioActivo() => new()
    {
        IdPortfolio       = IdPortfolio,
        IdUsuario         = IdUsuario,
        FechaCreacion     = DateTimeOffset.UtcNow,
        FechaModificacion = DateTimeOffset.UtcNow,
        Estado            = "ACTIVO"
    };

    private static EscenarioSimulacion[] EscenariosVigentes() =>
    [
        new(1, "FAVORABLE",    0.01m, 0.025m, 0.001m, 0.002m),
        new(2, "MODERADO",     0.025m, 0.05m, 0.002m, 0.004m),
        new(3, "DESFAVORABLE", 0.05m, 0.10m, 0.004m, 0.008m)
    ];

    private static AccionTenenciaSimulacion AccionConGbm(long id = 5) => new(
        id, "AAPL", 10m, 180m, 0.15m, 0.30m, 0.60m);

    private static TenenciasSimulacionData TenenciasConUnaAccion(AccionTenenciaSimulacion? accion = null) =>
        new([accion ?? AccionConGbm()], [], [], []);

    private static TenenciasSimulacionData TenenciasVacias() =>
        new([], [], [], []);

    private static JsonElement MotorResponseValido()
    {
        const string json = """
            {
              "semilla": 4242,
              "portfolio_ars": {
                "patrimonio":          { "global": { "media": [0,0], "mediana": [0,0], "p25": [0,0], "p75": [0,0], "minimo": [0,0], "maximo": [0,0] }, "favorable": {}, "moderado": {}, "desfavorable": {} },
                "ganancias_nominales": { "global": {}, "favorable": {}, "moderado": {}, "desfavorable": {} },
                "ganancias_reales":    { "global": { "media": [0,50], "mediana": [0,0], "p25": [0,0], "p75": [0,0], "minimo": [0,0], "maximo": [0,0] }, "favorable": {}, "moderado": {}, "desfavorable": {} }
              },
              "portfolio_usd": {
                "patrimonio":          { "global": { "media": [0,1800], "mediana": [0,0], "p25": [0,0], "p75": [0,0], "minimo": [0,1500], "maximo": [0,2200] }, "favorable": {}, "moderado": {}, "desfavorable": {} },
                "ganancias_nominales": { "global": {}, "favorable": {}, "moderado": {}, "desfavorable": {} },
                "ganancias_reales":    { "global": { "media": [0,200], "mediana": [0,0], "p25": [0,0], "p75": [0,0], "minimo": [0,0], "maximo": [0,0] }, "favorable": {}, "moderado": {}, "desfavorable": {} }
              },
              "instrumentos": {}
            }
            """;
        return JsonSerializer.Deserialize<JsonElement>(json);
    }

    private void ConfigurarTransaccionMock()
    {
        _simRepo.ExecuteInTransaccionAsync(
                Arg.Any<Func<IDbConnection, IDbTransaction, CancellationToken, Task>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci =>
            {
                var func = (Func<IDbConnection, IDbTransaction, CancellationToken, Task>)ci[0];
                var token = (CancellationToken)ci[1];
                return func(Substitute.For<IDbConnection>(), Substitute.For<IDbTransaction>(), token);
            });

        _simRepo.InsertSimulacionAsync(
                Arg.Any<InsertSimulacionData>(),
                Arg.Any<IDbConnection>(),
                Arg.Any<IDbTransaction>(),
                Arg.Any<CancellationToken>())
            .Returns(99L);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Simular_PortfolioNoExiste_LanzaNotFoundException()
    {
        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .ReturnsNull();

        var act = () => _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest(), default);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{IdPortfolio}*");
    }

    [Fact]
    public async Task Simular_PortfolioVacio_LanzaValidationException()
    {
        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .Returns(PortfolioActivo());
        _simRepo.ObtenerTenenciasParaSimulacionAsync(IdPortfolio, default)
            .Returns(TenenciasVacias());
        _simRepo.ObtenerEscenariosVigentesAsync(default)
            .Returns(EscenariosVigentes());

        var act = () => _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest(), default);

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*no tiene instrumentos*");
    }

    [Fact]
    public async Task Simular_AccionSinParametrosGBM_LanzaValidationException()
    {
        var accionSinGbm = new AccionTenenciaSimulacion(5, "AAPL", 10m, 180m, null, null, null);

        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .Returns(PortfolioActivo());
        _simRepo.ObtenerTenenciasParaSimulacionAsync(IdPortfolio, default)
            .Returns(TenenciasConUnaAccion(accionSinGbm));
        _simRepo.ObtenerEscenariosVigentesAsync(default)
            .Returns(EscenariosVigentes());

        var act = () => _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest(), default);

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*GBM*AAPL*");
    }

    [Fact]
    public async Task Simular_InstrumentoVencido_LanzaValidationException()
    {
        var letraVencida = new LetraTenenciaSimulacion(
            7, "lecap", 100m, 98m, 0.50m,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)));

        var tenencias = new TenenciasSimulacionData([], [], [letraVencida], []);

        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .Returns(PortfolioActivo());
        _simRepo.ObtenerTenenciasParaSimulacionAsync(IdPortfolio, default)
            .Returns(tenencias);
        _simRepo.ObtenerEscenariosVigentesAsync(default)
            .Returns(EscenariosVigentes());

        var act = () => _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest(), default);

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*vencido*letra_7*");
    }

    [Fact]
    public async Task Simular_MotorFalla_LanzaExternalApiException()
    {
        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .Returns(PortfolioActivo());
        _simRepo.ObtenerTenenciasParaSimulacionAsync(IdPortfolio, default)
            .Returns(TenenciasConUnaAccion());
        _simRepo.ObtenerEscenariosVigentesAsync(default)
            .Returns(EscenariosVigentes());
        _motor.SimularAsync(Arg.Any<object>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new ExternalApiException("Motor de simulación no disponible o devolvió error. Status: 500."));

        var act = () => _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest(), default);

        await act.Should().ThrowAsync<ExternalApiException>();
    }

    [Fact]
    public async Task Simular_HappyPath_RetornaSimulacionResumen()
    {
        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .Returns(PortfolioActivo());
        _simRepo.ObtenerTenenciasParaSimulacionAsync(IdPortfolio, default)
            .Returns(TenenciasConUnaAccion());
        _simRepo.ObtenerEscenariosVigentesAsync(default)
            .Returns(EscenariosVigentes());
        _motor.SimularAsync(Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(MotorResponseValido());
        ConfigurarTransaccionMock();

        var result = await _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest { HorizonteMeses = 12 }, default);

        result.Should().NotBeNull();
        result.IdSimulacion.Should().Be(99L);
        result.IdPortfolio.Should().Be(IdPortfolio);
        result.HorizonteMeses.Should().Be(12);
        result.NumTrayectorias.Should().Be(3000);

        await _simRepo.Received(1).InsertSimulacionAsync(
            Arg.Any<InsertSimulacionData>(),
            Arg.Any<IDbConnection>(),
            Arg.Any<IDbTransaction>(),
            Arg.Any<CancellationToken>());

        await _simRepo.Received(1).InsertResultadosAsync(
            99L,
            12,
            Arg.Any<JsonElement>(),
            Arg.Any<IDbConnection>(),
            Arg.Any<IDbTransaction>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public void MotorPayloadBuilder_PlazoFijoConFechaInicioPasada_SumaInteresDevengadoAlMonto()
    {
        // fechaInicio quedó 6 meses atrás pero el depósito todavía no venció (dura 365 días) — el
        // motor arranca su reloj en "today" y no sabe nada de lo transcurrido antes de esa fecha,
        // por eso el ajuste tiene que hacerse acá, antes de armar el payload.
        var today       = DateOnly.FromDateTime(DateTime.UtcNow);
        var fechaInicio = today.AddMonths(-6);
        var pf = new PlazoFijoTenenciaSimulacion(
            11, "TRADICIONAL", "ARS", 1000m, 0.12m, fechaInicio, 365, false);
        var tenencias = new TenenciasSimulacionData([], [], [], [pf]);
        var snapshots = new List<InstrumentoSimulacionSnapshot>();

        var payload = MotorPayloadBuilder.Build(tenencias, EscenariosVigentes(), 12, 1L, today, snapshots);

        var esperado = 1000m * (decimal)Math.Pow(1 + 0.12 / 12, 6);

        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(payload));
        var montoEnviado = doc.RootElement.GetProperty("instrumentos")[0].GetProperty("monto").GetDecimal();

        montoEnviado.Should().BeApproximately(esperado, 0.5m);
        montoEnviado.Should().BeGreaterThan(1000m);
        snapshots.Should().ContainSingle().Which.Monto.Should().BeApproximately(esperado, 0.5m);
    }

    [Fact]
    public async Task Simular_BonoVenceDespuesDelHorizonte_NoLanzaExcepcion()
    {
        // El motor trunca la trayectoria del bono al horizonte elegido — ya no se bloquea la simulación.
        var bonoLargoPlazo = new BonoTenenciaSimulacion(
            3, "AL30", "bono_tasa_fija", 100m, 92m, 0.15m,
            [new FlujoSimulacion(DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(18)), 0m, 110m)]);

        var tenencias = new TenenciasSimulacionData([], [bonoLargoPlazo], [], []);

        _portfolioRepo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, default)
            .Returns(PortfolioActivo());
        _simRepo.ObtenerTenenciasParaSimulacionAsync(IdPortfolio, default)
            .Returns(tenencias);
        _simRepo.ObtenerEscenariosVigentesAsync(default)
            .Returns(EscenariosVigentes());
        _motor.SimularAsync(Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(MotorResponseValido());
        ConfigurarTransaccionMock();

        var act = () => _svc.SimularAsync(IdPortfolio, IdUsuario, new SimularRequest { HorizonteMeses = 6 }, default);

        await act.Should().NotThrowAsync();
    }
}

using FluentAssertions;
using NSubstitute;
using NSubstitute.ReturnsExtensions;
using SimuladorFinanciero.Api.DTOs.Portfolio;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Tests.Portfolios;

public class PortfolioServiceTests
{
    private readonly IPortfolioRepository _repo;
    private readonly ITipoCambioService   _tipoCambio;
    private readonly PortfolioService     _svc;

    private const long IdUsuario   = 42;
    private const long IdPortfolio = 1;
    private const long IdAccion    = 5;
    private const long IdBono      = 3;
    private const long IdLetra     = 7;
    private const long IdPlazoFijo = 401;

    public PortfolioServiceTests()
    {
        _repo       = Substitute.For<IPortfolioRepository>();
        _tipoCambio = Substitute.For<ITipoCambioService>();
        _svc        = new PortfolioService(_repo, _tipoCambio);

        // Todos los portfolios de prueba usan id_moneda_base = 1 (ARS); las cotizaciones USD/ARS
        // se estuban con una tasa fija de 1:1 salvo que un test específico la sobreescriba.
        _repo.ObtenerCodigoMonedaAsync(1, Arg.Any<CancellationToken>()).Returns("ARS");
        _tipoCambio.ObtenerCotizacionUsdArsAsync(Arg.Any<CancellationToken>()).Returns(1m);
    }

    // ── Datos de prueba ───────────────────────────────────────────────────────

    private static Portfolio PortfolioActivo(int idPerfil = 2, decimal? capitalInicial = null, int idMonedaBase = 1, string codigoMonedaBase = "ARS") => new()
    {
        IdPortfolio       = IdPortfolio,
        IdUsuario         = IdUsuario,
        IdPerfilRiesgo    = idPerfil,
        IdMonedaBase      = idMonedaBase,
        CodigoMonedaBase  = codigoMonedaBase,
        Nombre            = "Mi Portfolio",
        CapitalInicial    = capitalInicial,
        HorizonteMeses    = 12,
        FechaCreacion     = DateTimeOffset.UtcNow,
        FechaModificacion = DateTimeOffset.UtcNow,
        Estado            = "ACTIVO"
    };

    private static Portfolio PortfolioArchivado() => new()
    {
        IdPortfolio       = IdPortfolio,
        IdUsuario         = IdUsuario,
        IdPerfilRiesgo    = 2,
        IdMonedaBase      = 1,
        CodigoMonedaBase  = "ARS",
        Nombre            = "Mi Portfolio",
        CapitalInicial    = null,
        HorizonteMeses    = 12,
        FechaCreacion     = DateTimeOffset.UtcNow,
        FechaModificacion = DateTimeOffset.UtcNow,
        Estado            = "ARCHIVADO"
    };

    private static PortfolioResumenResponse ResumenEjemplo(string nombre = "Mi Portfolio") => new(
        IdPortfolio, nombre, null, 2, "Moderado",
        1, "ARS", 100_000m, 12, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "ACTIVO");

    private static PortfolioDetalleResponse DetalleEjemplo() => new(
        IdPortfolio, "Mi Portfolio", null, 2, "Moderado",
        1, "ARS", 100_000m, 12, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "ACTIVO",
        [], [], [], []);

    private static PortfolioAccionResponse AccionEjemplo() => new(
        101, IdAccion, "AAPL", "Apple Inc.", "Tecnología",
        0.005m, 0.04m, 195m, 10m, 180m);

    private static PortfolioBonoResponse BonoEjemplo() => new(
        201, IdBono, "AL30", "BONAR 2030", "Ministerio",
        95m, 100m, 92m);

    private static PortfolioLetraResponse LetraEjemplo() => new(
        301, IdLetra, "LECAP2025", "LECAP Dic 2025", 0.035m,
        new DateOnly(2025, 12, 31), 98m, 50m, 97m);

    private static PortfolioPlazoFijoResponse PlazoFijoEjemplo() => new(
        IdPlazoFijo, 1, "TRADICIONAL", 1, "ARS",
        "Banco Nación", 500_000m, 0.40m, new DateOnly(2024, 1, 15), 3, false);

    private static CrearPortfolioRequest ReqCrear() => new()
    {
        Nombre         = "Nuevo Portfolio",
        IdPerfilRiesgo = 2,
        IdMonedaBase   = 1,
        CapitalInicial = 50_000m,
        HorizonteMeses = 24
    };

    // ── CrearAsync ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Crear_HappyPath_DevuelveResumen()
    {
        var req     = ReqCrear();
        var resumen = ResumenEjemplo();
        _repo.ExistePerfilRiesgoAsync(req.IdPerfilRiesgo, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteMonedaAsync(req.IdMonedaBase, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteNombreAsync(IdUsuario, req.Nombre, req.IdPerfilRiesgo, Arg.Any<CancellationToken>()).Returns(false);
        _repo.CrearAsync(IdUsuario, req, Arg.Any<CancellationToken>()).Returns(resumen);

        var result = await _svc.CrearAsync(IdUsuario, req);

        result.Should().Be(resumen);
    }

    [Fact]
    public async Task Crear_PerfilNoExiste_LanzaNotFoundException()
    {
        var req = ReqCrear();
        _repo.ExistePerfilRiesgoAsync(req.IdPerfilRiesgo, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.CrearAsync(IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Perfil de riesgo*");
    }

    [Fact]
    public async Task Crear_MonedaNoExiste_LanzaNotFoundException()
    {
        var req = ReqCrear();
        _repo.ExistePerfilRiesgoAsync(req.IdPerfilRiesgo, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteMonedaAsync(req.IdMonedaBase, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.CrearAsync(IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Moneda*");
    }

    [Fact]
    public async Task Crear_NombreDuplicado_LanzaConflictException()
    {
        var req = ReqCrear();
        _repo.ExistePerfilRiesgoAsync(req.IdPerfilRiesgo, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteMonedaAsync(req.IdMonedaBase, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteNombreAsync(IdUsuario, req.Nombre, req.IdPerfilRiesgo, Arg.Any<CancellationToken>()).Returns(true);

        var act = () => _svc.CrearAsync(IdUsuario, req);

        await act.Should().ThrowAsync<ConflictException>().WithMessage($"*'{req.Nombre}'*");
    }

    // ── ObtenerDetalleAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task ObtenerDetalle_HappyPath_DevuelveDetalle()
    {
        var detalle = DetalleEjemplo();
        _repo.ObtenerDetalleAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).Returns(detalle);

        var result = await _svc.ObtenerDetalleAsync(IdPortfolio, IdUsuario);

        result.Should().Be(detalle);
    }

    [Fact]
    public async Task ObtenerDetalle_NoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerDetalleAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).ReturnsNull();

        var act = () => _svc.ObtenerDetalleAsync(IdPortfolio, IdUsuario);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Portfolio {IdPortfolio}*");
    }

    // ── ActualizarAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task Actualizar_HappyPath_DevuelveResumenActualizado()
    {
        var req     = new ActualizarPortfolioRequest { Nombre = "Renombrado" };
        var resumen = ResumenEjemplo("Renombrado");
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteNombreParaOtroAsync(IdUsuario, "Renombrado", 2, IdPortfolio, Arg.Any<CancellationToken>())
             .Returns(false);
        _repo.ActualizarAsync(IdPortfolio, IdUsuario,
             Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<int>(),
             Arg.Any<decimal?>(), Arg.Any<int>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
             .Returns(resumen);

        var result = await _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        result.Nombre.Should().Be("Renombrado");
    }

    [Fact]
    public async Task Actualizar_PortfolioNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).ReturnsNull();

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, new ActualizarPortfolioRequest());

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Portfolio {IdPortfolio}*");
    }

    [Fact]
    public async Task Actualizar_NombreDuplicadoParaOtro_LanzaConflictException()
    {
        var req = new ActualizarPortfolioRequest { Nombre = "Nombre Ocupado" };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteNombreParaOtroAsync(IdUsuario, "Nombre Ocupado", 2, IdPortfolio, Arg.Any<CancellationToken>())
             .Returns(true);

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ConflictException>().WithMessage("*'Nombre Ocupado'*");
    }

    [Fact]
    public async Task Actualizar_NuevoPerfilNoExiste_LanzaNotFoundException()
    {
        var req = new ActualizarPortfolioRequest { IdPerfilRiesgo = 99 };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 2));
        _repo.ExistePerfilRiesgoAsync(99, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Perfil de riesgo 99*");
    }

    [Fact]
    public async Task Actualizar_NuevoPerfilIncompatibleConAcciones_LanzaValidationException()
    {
        var req = new ActualizarPortfolioRequest { IdPerfilRiesgo = 1 };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 2));
        _repo.ExistePerfilRiesgoAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteNombreParaOtroAsync(IdUsuario, "Mi Portfolio", 1, IdPortfolio, Arg.Any<CancellationToken>())
             .Returns(false);
        _repo.AccionesCompatiblesConPerfilAsync(IdPortfolio, 1, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*restrictivo*");
    }

    [Fact]
    public async Task Actualizar_CambioPerfil_NombreOcupadoEnNuevoPerfil_LanzaConflictException()
    {
        var req = new ActualizarPortfolioRequest { IdPerfilRiesgo = 1 };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 2));
        _repo.ExistePerfilRiesgoAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteNombreParaOtroAsync(IdUsuario, "Mi Portfolio", 1, IdPortfolio, Arg.Any<CancellationToken>())
             .Returns(true);

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ConflictException>().WithMessage("*'Mi Portfolio'*");
    }

    [Fact]
    public async Task Actualizar_NuevaMonedaNoExiste_LanzaNotFoundException()
    {
        var req = new ActualizarPortfolioRequest { IdMonedaBase = 99 };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteMonedaAsync(99, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Moneda 99*");
    }

    // ── EliminarAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Eliminar_HappyPath_LlamaRepositorio()
    {
        _repo.EliminarAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).Returns(true);

        await _svc.EliminarAsync(IdPortfolio, IdUsuario);

        await _repo.Received(1).EliminarAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Eliminar_NoExiste_LanzaNotFoundException()
    {
        _repo.EliminarAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.EliminarAsync(IdPortfolio, IdUsuario);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Portfolio {IdPortfolio}*");
    }

    // ── AgregarAccionAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task AgregarAccion_HappyPath_DevuelveAccion()
    {
        var req    = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };
        var accion = AccionEjemplo();
        ConfigurarAccionValida(sigmaAccion: 0.04m, sigmaMax: 0.10m);
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);
        _repo.AgregarAccionAsync(IdPortfolio, IdAccion, 10m, 180m, Arg.Any<CancellationToken>()).Returns(accion);

        var result = await _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        result.Should().Be(accion);
    }

    [Fact]
    public async Task AgregarAccion_PortfolioNoEncontrado_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).ReturnsNull();
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Portfolio {IdPortfolio}*");
    }

    [Fact]
    public async Task AgregarAccion_PortfolioArchivado_LanzaValidationException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioArchivado());
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*archivado*");
    }

    [Fact]
    public async Task AgregarAccion_AccionNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        (bool Activa, decimal? Sigma)? nulo = null;
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(nulo));
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Acción {IdAccion}*");
    }

    [Fact]
    public async Task AgregarAccion_AccionInactiva_LanzaValidationException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        (bool Activa, decimal? Sigma)? inactiva = (false, null);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(inactiva));
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage($"*{IdAccion}*activa*");
    }

    [Fact]
    public async Task AgregarAccion_SigmaExcedeMax_LanzaValidationException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 1));
        (bool Activa, decimal? Sigma)? altaVolatilidad = (true, 0.20m);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(altaVolatilidad));
        _repo.ObtenerSigmaMaxAsync(1, Arg.Any<CancellationToken>()).Returns(0.05m);
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*volatilidad*");
    }

    [Fact]
    public async Task AgregarAccion_SinSigmaEstimada_OmiteValidacionSigmaYTieneExito()
    {
        var accion = AccionEjemplo();
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 1));
        (bool Activa, decimal? Sigma)? sinParametros = (true, null);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(sinParametros));
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);
        _repo.AgregarAccionAsync(IdPortfolio, IdAccion, 5m, 200m, Arg.Any<CancellationToken>()).Returns(accion);
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 5m, PrecioCompra = 200m };

        var result = await _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        result.Should().NotBeNull();
        await _repo.DidNotReceive().ObtenerSigmaMaxAsync(Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AgregarAccion_DuplicadaEnPortfolio_LanzaConflictException()
    {
        ConfigurarAccionValida(sigmaAccion: 0.04m, sigmaMax: 0.30m);
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(true);
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ConflictException>().WithMessage($"*{IdAccion}*ya existe*");
    }

    // ── ActualizarAccionAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task ActualizarAccion_HappyPath_MergeConValoresActuales()
    {
        var actual  = AccionEjemplo();
        var updated = actual with { Cantidad = 20m };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ObtenerAccionTenenciaAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>())
             .Returns(actual);
        _repo.ActualizarAccionAsync(IdPortfolio, IdAccion, 20m, actual.PrecioCompra, Arg.Any<CancellationToken>())
             .Returns(updated);
        var req = new ActualizarAccionRequest { Cantidad = 20m };

        var result = await _svc.ActualizarAccionAsync(IdPortfolio, IdUsuario, IdAccion, req);

        result.Cantidad.Should().Be(20m);
        result.PrecioCompra.Should().Be(actual.PrecioCompra);
    }

    [Fact]
    public async Task ActualizarAccion_PortfolioNoEncontrado_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).ReturnsNull();

        var act = () => _svc.ActualizarAccionAsync(IdPortfolio, IdUsuario, IdAccion,
                            new ActualizarAccionRequest { Cantidad = 5m });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task ActualizarAccion_PortfolioArchivado_LanzaValidationException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioArchivado());

        var act = () => _svc.ActualizarAccionAsync(IdPortfolio, IdUsuario, IdAccion,
                            new ActualizarAccionRequest { Cantidad = 5m });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*archivado*");
    }

    [Fact]
    public async Task ActualizarAccion_TenenciaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ObtenerAccionTenenciaAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>())
             .ReturnsNull();

        var act = () => _svc.ActualizarAccionAsync(IdPortfolio, IdUsuario, IdAccion,
                            new ActualizarAccionRequest { Cantidad = 5m });

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*acción {IdAccion}*");
    }

    // ── EliminarAccionAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task EliminarAccion_HappyPath_LlamaRepositorio()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.EliminarAccionAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(true);

        await _svc.EliminarAccionAsync(IdPortfolio, IdUsuario, IdAccion);

        await _repo.Received(1).EliminarAccionAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EliminarAccion_TenenciaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.EliminarAccionAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.EliminarAccionAsync(IdPortfolio, IdUsuario, IdAccion);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*acción {IdAccion}*");
    }

    // ── AgregarBonoAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task AgregarBono_HappyPath_DevuelveBono()
    {
        var req  = new AgregarBonoRequest { IdBono = IdBono, Cantidad = 100m, PrecioCompra = 92m };
        var bono = BonoEjemplo();
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteBonoActivoAsync(IdBono, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteBonoEnPortfolioAsync(IdPortfolio, IdBono, Arg.Any<CancellationToken>()).Returns(false);
        _repo.AgregarBonoAsync(IdPortfolio, IdBono, 100m, 92m, Arg.Any<CancellationToken>()).Returns(bono);

        var result = await _svc.AgregarBonoAsync(IdPortfolio, IdUsuario, req);

        result.Should().Be(bono);
    }

    [Fact]
    public async Task AgregarBono_BonoInactivo_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteBonoActivoAsync(IdBono, Arg.Any<CancellationToken>()).Returns(false);
        var req = new AgregarBonoRequest { IdBono = IdBono, Cantidad = 100m, PrecioCompra = 92m };

        var act = () => _svc.AgregarBonoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Bono {IdBono}*");
    }

    [Fact]
    public async Task AgregarBono_DuplicadoEnPortfolio_LanzaConflictException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteBonoActivoAsync(IdBono, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteBonoEnPortfolioAsync(IdPortfolio, IdBono, Arg.Any<CancellationToken>()).Returns(true);
        var req = new AgregarBonoRequest { IdBono = IdBono, Cantidad = 100m, PrecioCompra = 92m };

        var act = () => _svc.AgregarBonoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ConflictException>().WithMessage($"*{IdBono}*ya existe*");
    }

    [Fact]
    public async Task AgregarBono_PortfolioArchivado_LanzaValidationException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioArchivado());
        var req = new AgregarBonoRequest { IdBono = IdBono, Cantidad = 100m, PrecioCompra = 92m };

        var act = () => _svc.AgregarBonoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*archivado*");
    }

    // ── ActualizarBonoAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task ActualizarBono_TenenciaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ObtenerBonoTenenciaAsync(IdPortfolio, IdBono, Arg.Any<CancellationToken>())
             .ReturnsNull();

        var act = () => _svc.ActualizarBonoAsync(IdPortfolio, IdUsuario, IdBono,
                            new ActualizarBonoRequest { Cantidad = 50m });

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*bono {IdBono}*");
    }

    [Fact]
    public async Task EliminarBono_TenenciaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.EliminarBonoAsync(IdPortfolio, IdBono, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.EliminarBonoAsync(IdPortfolio, IdUsuario, IdBono);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*bono {IdBono}*");
    }

    // ── AgregarLetraAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task AgregarLetra_HappyPath_DevuelveLetra()
    {
        var req   = new AgregarLetraRequest { IdLetra = IdLetra, Cantidad = 50m, PrecioCompra = 97m };
        var letra = LetraEjemplo();
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteLetraActivaAsync(IdLetra, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteLetraEnPortfolioAsync(IdPortfolio, IdLetra, Arg.Any<CancellationToken>()).Returns(false);
        _repo.AgregarLetraAsync(IdPortfolio, IdLetra, 50m, 97m, Arg.Any<CancellationToken>()).Returns(letra);

        var result = await _svc.AgregarLetraAsync(IdPortfolio, IdUsuario, req);

        result.Should().Be(letra);
    }

    [Fact]
    public async Task AgregarLetra_LetraInactiva_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteLetraActivaAsync(IdLetra, Arg.Any<CancellationToken>()).Returns(false);
        var req = new AgregarLetraRequest { IdLetra = IdLetra, Cantidad = 50m, PrecioCompra = 97m };

        var act = () => _svc.AgregarLetraAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Letra {IdLetra}*");
    }

    [Fact]
    public async Task AgregarLetra_DuplicadaEnPortfolio_LanzaConflictException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteLetraActivaAsync(IdLetra, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteLetraEnPortfolioAsync(IdPortfolio, IdLetra, Arg.Any<CancellationToken>()).Returns(true);
        var req = new AgregarLetraRequest { IdLetra = IdLetra, Cantidad = 50m, PrecioCompra = 97m };

        var act = () => _svc.AgregarLetraAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ConflictException>().WithMessage($"*{IdLetra}*ya existe*");
    }

    [Fact]
    public async Task ActualizarLetra_TenenciaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ObtenerLetraTenenciaAsync(IdPortfolio, IdLetra, Arg.Any<CancellationToken>())
             .ReturnsNull();

        var act = () => _svc.ActualizarLetraAsync(IdPortfolio, IdUsuario, IdLetra,
                            new ActualizarLetraRequest { Cantidad = 30m });

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*letra {IdLetra}*");
    }

    // ── AgregarPlazoFijoAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task AgregarPlazoFijo_HappyPath_DevuelvePlazoFijo()
    {
        var req = new AgregarPlazoFijoRequest
        {
            IdTipoPlazoFijo        = 1,
            IdMoneda               = 1,
            EntidadFinanciera      = "Banco Nación",
            MontoInvertido         = 500_000m,
            TnaPactada             = 0.40m,
            FechaInicio            = DateOnly.FromDateTime(DateTime.UtcNow),
            DuracionDias          = 3,
            ReinvertirAlVencimiento = false
        };
        var pf = PlazoFijoEjemplo();
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteTipoPlazoFijoAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteMonedaAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.AgregarPlazoFijoAsync(IdPortfolio, Arg.Any<AgregarPlazoFijoRequest>(), Arg.Any<CancellationToken>())
             .Returns(pf);

        var result = await _svc.AgregarPlazoFijoAsync(IdPortfolio, IdUsuario, req);

        result.Should().Be(pf);
    }

    [Fact]
    public async Task AgregarPlazoFijo_TipoNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteTipoPlazoFijoAsync(99, Arg.Any<CancellationToken>()).Returns(false);
        var req = new AgregarPlazoFijoRequest
        {
            IdTipoPlazoFijo   = 99, IdMoneda = 1, EntidadFinanciera = "Banco",
            MontoInvertido    = 1_000m, TnaPactada = 0.40m,
            FechaInicio       = new DateOnly(2024, 1, 15), DuracionDias = 3
        };

        var act = () => _svc.AgregarPlazoFijoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Tipo de plazo fijo 99*");
    }

    [Fact]
    public async Task AgregarPlazoFijo_MonedaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ExisteTipoPlazoFijoAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteMonedaAsync(99, Arg.Any<CancellationToken>()).Returns(false);
        var req = new AgregarPlazoFijoRequest
        {
            IdTipoPlazoFijo   = 1, IdMoneda = 99, EntidadFinanciera = "Banco",
            MontoInvertido    = 1_000m, TnaPactada = 0.40m,
            FechaInicio       = new DateOnly(2024, 1, 15), DuracionDias = 3
        };

        var act = () => _svc.AgregarPlazoFijoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Moneda 99*");
    }

    [Fact]
    public async Task AgregarPlazoFijo_PortfolioArchivado_LanzaValidationException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioArchivado());
        var req = new AgregarPlazoFijoRequest
        {
            IdTipoPlazoFijo   = 1, IdMoneda = 1, EntidadFinanciera = "Banco",
            MontoInvertido    = 1_000m, TnaPactada = 0.40m,
            FechaInicio       = new DateOnly(2024, 1, 15), DuracionDias = 3
        };

        var act = () => _svc.AgregarPlazoFijoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*archivado*");
    }

    // ── ActualizarPlazoFijoAsync ──────────────────────────────────────────────

    [Fact]
    public async Task ActualizarPlazoFijo_HappyPath_MergeConValoresActuales()
    {
        var actual  = PlazoFijoEjemplo();
        var updated = actual with { MontoInvertido = 750_000m };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ObtenerPlazoFijoTenenciaAsync(IdPlazoFijo, IdPortfolio, Arg.Any<CancellationToken>())
             .Returns(actual);
        _repo.ActualizarPlazoFijoAsync(
             IdPlazoFijo, IdPortfolio,
             Arg.Is<ActualizarPlazoFijoData>(d => d.MontoInvertido == 750_000m && d.TnaPactada == actual.TnaPactada),
             Arg.Any<CancellationToken>())
             .Returns(updated);
        var req = new ActualizarPlazoFijoRequest { MontoInvertido = 750_000m };

        var result = await _svc.ActualizarPlazoFijoAsync(IdPortfolio, IdUsuario, IdPlazoFijo, req);

        result.MontoInvertido.Should().Be(750_000m);
        result.TnaPactada.Should().Be(actual.TnaPactada);
    }

    [Fact]
    public async Task ActualizarPlazoFijo_TenenciaNoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.ObtenerPlazoFijoTenenciaAsync(IdPlazoFijo, IdPortfolio, Arg.Any<CancellationToken>())
             .ReturnsNull();

        var act = () => _svc.ActualizarPlazoFijoAsync(IdPortfolio, IdUsuario, IdPlazoFijo,
                            new ActualizarPlazoFijoRequest { MontoInvertido = 100m });

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Plazo fijo {IdPlazoFijo}*");
    }

    // ── EliminarPlazoFijoAsync ────────────────────────────────────────────────

    [Fact]
    public async Task EliminarPlazoFijo_HappyPath_LlamaRepositorio()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.EliminarPlazoFijoAsync(IdPlazoFijo, IdPortfolio, Arg.Any<CancellationToken>()).Returns(true);

        await _svc.EliminarPlazoFijoAsync(IdPortfolio, IdUsuario, IdPlazoFijo);

        await _repo.Received(1).EliminarPlazoFijoAsync(IdPlazoFijo, IdPortfolio, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EliminarPlazoFijo_NoExiste_LanzaNotFoundException()
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo());
        _repo.EliminarPlazoFijoAsync(IdPlazoFijo, IdPortfolio, Arg.Any<CancellationToken>()).Returns(false);

        var act = () => _svc.EliminarPlazoFijoAsync(IdPortfolio, IdUsuario, IdPlazoFijo);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage($"*Plazo fijo {IdPlazoFijo}*");
    }

    // ── Presupuesto ───────────────────────────────────────────────────────────

    [Fact]
    public async Task AgregarAccion_SinPresupuesto_OmiteValidacion()
    {
        // CapitalInicial = null → budget check skipped, no call to ObtenerTotalInvertidoPorMonedaAsync
        var req    = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };
        var accion = AccionEjemplo();
        ConfigurarAccionValida(sigmaAccion: 0.04m, sigmaMax: 0.10m);
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);
        _repo.AgregarAccionAsync(IdPortfolio, IdAccion, 10m, 180m, Arg.Any<CancellationToken>()).Returns(accion);

        await _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await _repo.DidNotReceive().ObtenerTotalInvertidoPorMonedaAsync(Arg.Any<long>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AgregarAccion_ExcedePresupuesto_LanzaValidationException()
    {
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };
        // Portfolio (base ARS) con presupuesto de 1000, ya invertido 900 ARS → añadir una acción
        // (siempre USD) de 1800 la excede, incluso a una cotización 1:1
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 2, capitalInicial: 1_000m));
        (bool Activa, decimal? Sigma)? info = (true, 0.04m);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(info));
        _repo.ObtenerSigmaMaxAsync(2, Arg.Any<CancellationToken>()).Returns(0.10m);
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);
        _repo.ObtenerTotalInvertidoPorMonedaAsync(IdPortfolio, Arg.Any<CancellationToken>()).Returns((0m, 900m));

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*presupuesto*");
    }

    [Fact]
    public async Task AgregarBono_ExcedePresupuesto_LanzaValidationException()
    {
        var req = new AgregarBonoRequest { IdBono = IdBono, Cantidad = 100m, PrecioCompra = 92m };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(capitalInicial: 5_000m));
        _repo.ExisteBonoActivoAsync(IdBono, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteBonoEnPortfolioAsync(IdPortfolio, IdBono, Arg.Any<CancellationToken>()).Returns(false);
        _repo.ObtenerTotalInvertidoPorMonedaAsync(IdPortfolio, Arg.Any<CancellationToken>()).Returns((0m, 0m));
        // 0 + 100 * 92 = 9200 > 5000

        var act = () => _svc.AgregarBonoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*presupuesto*");
    }

    [Fact]
    public async Task AgregarPlazoFijo_ExcedePresupuesto_LanzaValidationException()
    {
        var req = new AgregarPlazoFijoRequest
        {
            IdTipoPlazoFijo   = 1, IdMoneda = 1, EntidadFinanciera = "Banco",
            MontoInvertido    = 500_000m, TnaPactada = 0.40m,
            FechaInicio       = DateOnly.FromDateTime(DateTime.UtcNow), DuracionDias = 3
        };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(capitalInicial: 100_000m));
        _repo.ExisteTipoPlazoFijoAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ExisteMonedaAsync(1, Arg.Any<CancellationToken>()).Returns(true);
        _repo.ObtenerTotalInvertidoPorMonedaAsync(IdPortfolio, Arg.Any<CancellationToken>()).Returns((0m, 0m));
        // 0 + 500_000 > 100_000

        var act = () => _svc.AgregarPlazoFijoAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*presupuesto*");
    }

    [Fact]
    public async Task ActualizarPortfolio_ReducirPresupuestoBajoTotalInvertido_LanzaValidationException()
    {
        var req = new ActualizarPortfolioRequest { CapitalInicial = 500m };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(capitalInicial: 100_000m));
        _repo.ObtenerTotalInvertidoPorMonedaAsync(IdPortfolio, Arg.Any<CancellationToken>()).Returns((0m, 10_000m));
        // Nuevo presupuesto 500 < 10_000 ya invertido

        var act = () => _svc.ActualizarAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*presupuesto*");
    }

    [Fact]
    public async Task AgregarAccion_MismaMonedaQueBase_NoConsultaTipoCambio()
    {
        // Portfolio con base USD (id_moneda_base = 2) y una acción (siempre USD): no hay conversión que hacer
        var req    = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };
        var accion = AccionEjemplo();
        var portfolioUsd = PortfolioActivo(idPerfil: 2, capitalInicial: 10_000m, idMonedaBase: 2, codigoMonedaBase: "USD");
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>()).Returns(portfolioUsd);
        (bool Activa, decimal? Sigma)? info = (true, 0.04m);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(info));
        _repo.ObtenerSigmaMaxAsync(2, Arg.Any<CancellationToken>()).Returns(0.10m);
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);
        _repo.ObtenerTotalInvertidoPorMonedaAsync(IdPortfolio, Arg.Any<CancellationToken>()).Returns((0m, 0m));
        _repo.AgregarAccionAsync(IdPortfolio, IdAccion, 10m, 180m, Arg.Any<CancellationToken>()).Returns(accion);

        await _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await _tipoCambio.DidNotReceive().ObtenerCotizacionUsdArsAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AgregarAccion_TipoCambioNoDisponible_PropagaExcepcion()
    {
        // Portfolio base ARS con una acción (USD) pendiente de convertir: si el BCRA falla y no hay
        // valor previo, ITipoCambioService propaga la excepción y el alta queda bloqueada
        var req = new AgregarAccionRequest { IdAccion = IdAccion, Cantidad = 10m, PrecioCompra = 180m };
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 2, capitalInicial: 100_000m));
        (bool Activa, decimal? Sigma)? info = (true, 0.04m);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(info));
        _repo.ObtenerSigmaMaxAsync(2, Arg.Any<CancellationToken>()).Returns(0.10m);
        _repo.ExisteAccionEnPortfolioAsync(IdPortfolio, IdAccion, Arg.Any<CancellationToken>()).Returns(false);
        _repo.ObtenerTotalInvertidoPorMonedaAsync(IdPortfolio, Arg.Any<CancellationToken>()).Returns((0m, 0m));
        _tipoCambio.ObtenerCotizacionUsdArsAsync(Arg.Any<CancellationToken>())
             .Returns(Task.FromException<decimal>(new ExternalApiException("BCRA no disponible.")));

        var act = () => _svc.AgregarAccionAsync(IdPortfolio, IdUsuario, req);

        await act.Should().ThrowAsync<ExternalApiException>();
    }

    // ── Setup helpers ─────────────────────────────────────────────────────────

    private void ConfigurarAccionValida(decimal sigmaAccion, decimal sigmaMax)
    {
        _repo.ObtenerCabeceraAsync(IdPortfolio, IdUsuario, Arg.Any<CancellationToken>())
             .Returns(PortfolioActivo(idPerfil: 2));
        (bool Activa, decimal? Sigma)? info = (true, sigmaAccion);
        _repo.ObtenerInfoAccionAsync(IdAccion, Arg.Any<CancellationToken>())
             .Returns(Task.FromResult(info));
        _repo.ObtenerSigmaMaxAsync(2, Arg.Any<CancellationToken>()).Returns(sigmaMax);
    }
}

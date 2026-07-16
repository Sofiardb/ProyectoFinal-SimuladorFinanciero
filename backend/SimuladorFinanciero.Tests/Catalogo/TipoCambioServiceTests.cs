using FluentAssertions;
using NSubstitute;
using NSubstitute.ReturnsExtensions;
using SimuladorFinanciero.Api.DTOs.Referencia;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Bcra;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Tests.Catalogo;

public class TipoCambioServiceTests
{
    private const int IdUsd = 2;
    private const int IdArs = 1;

    private readonly IBcraApiClient        _bcra;
    private readonly ITipoCambioRepository _tipoCambioRepo;
    private readonly IReferenciaRepository _referenciaRepo;
    private readonly TipoCambioService     _svc;

    public TipoCambioServiceTests()
    {
        _bcra           = Substitute.For<IBcraApiClient>();
        _tipoCambioRepo = Substitute.For<ITipoCambioRepository>();
        _referenciaRepo = Substitute.For<IReferenciaRepository>();
        _svc            = new TipoCambioService(_bcra, _tipoCambioRepo, _referenciaRepo);

        IReadOnlyList<MonedaResponse> monedas =
        [
            new MonedaResponse(IdArs, "ARS", "Peso", "$"),
            new MonedaResponse(IdUsd, "USD", "Dólar", "US$"),
        ];
        _referenciaRepo.ObtenerMonedasAsync(Arg.Any<CancellationToken>()).Returns(monedas);
    }

    [Fact]
    public async Task CotizacionDelDiaYaPersistida_NoConsultaBcra()
    {
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(1_400m);

        var (valor, fecha) = await _svc.ObtenerCotizacionUsdArsAsync();

        valor.Should().Be(1_400m);
        fecha.Should().Be(DateOnly.FromDateTime(DateTime.UtcNow));
        await _bcra.DidNotReceive().ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SinCotizacionDelDia_ConsultaBcraYLaPersiste()
    {
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .ReturnsNull();
        _bcra.ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>()).Returns(1_500m);

        var (valor, fecha) = await _svc.ObtenerCotizacionUsdArsAsync();

        valor.Should().Be(1_500m);
        fecha.Should().Be(DateOnly.FromDateTime(DateTime.UtcNow));
        await _tipoCambioRepo.Received(1).GuardarCotizacionAsync(
            IdUsd, IdArs, Arg.Any<DateOnly>(), 1_500m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BcraFalla_ExisteCotizacionPrevia_DevuelveElUltimoValorYSuFecha()
    {
        var fechaAnterior = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .ReturnsNull();
        _bcra.ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<decimal>(new ExternalApiException("BCRA no disponible.")));
        (decimal Valor, DateOnly Fecha)? ultima = (1_350m, fechaAnterior);
        _tipoCambioRepo.ObtenerUltimaCotizacionAsync(IdUsd, IdArs, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(ultima));

        var (valor, fecha) = await _svc.ObtenerCotizacionUsdArsAsync();

        valor.Should().Be(1_350m);
        fecha.Should().Be(fechaAnterior);
    }

    [Fact]
    public async Task RefrescarAsync_IgnoraCacheDelDiaYConsultaBcra()
    {
        // Ya hay una cotización cacheada hoy, pero RefrescarAsync debe ignorarla e ir siempre al BCRA
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(1_400m);
        _bcra.ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>()).Returns(1_600m);

        var resultado = await _svc.RefrescarAsync();

        resultado.Should().Be(1_600m);
        await _tipoCambioRepo.Received(1).GuardarCotizacionAsync(
            IdUsd, IdArs, Arg.Any<DateOnly>(), 1_600m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BcraFalla_SinCotizacionPrevia_PropagaExcepcion()
    {
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .ReturnsNull();
        _bcra.ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<decimal>(new ExternalApiException("BCRA no disponible.")));
        (decimal Valor, DateOnly Fecha)? ultima = null;
        _tipoCambioRepo.ObtenerUltimaCotizacionAsync(IdUsd, IdArs, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(ultima));

        var act = () => _svc.ObtenerCotizacionUsdArsAsync();

        await act.Should().ThrowAsync<ExternalApiException>();
    }
}

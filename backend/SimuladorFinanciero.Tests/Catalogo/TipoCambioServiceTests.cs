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

        var resultado = await _svc.ObtenerCotizacionUsdArsAsync();

        resultado.Should().Be(1_400m);
        await _bcra.DidNotReceive().ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SinCotizacionDelDia_ConsultaBcraYLaPersiste()
    {
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .ReturnsNull();
        _bcra.ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>()).Returns(1_500m);

        var resultado = await _svc.ObtenerCotizacionUsdArsAsync();

        resultado.Should().Be(1_500m);
        await _tipoCambioRepo.Received(1).GuardarCotizacionAsync(
            IdUsd, IdArs, Arg.Any<DateOnly>(), 1_500m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BcraFalla_ExisteCotizacionPrevia_DevuelveElUltimoValor()
    {
        _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(IdUsd, IdArs, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .ReturnsNull();
        _bcra.ObtenerCotizacionUsdAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<decimal>(new ExternalApiException("BCRA no disponible.")));
        _tipoCambioRepo.ObtenerUltimaCotizacionAsync(IdUsd, IdArs, Arg.Any<CancellationToken>())
            .Returns(1_350m);

        var resultado = await _svc.ObtenerCotizacionUsdArsAsync();

        resultado.Should().Be(1_350m);
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
        _tipoCambioRepo.ObtenerUltimaCotizacionAsync(IdUsd, IdArs, Arg.Any<CancellationToken>())
            .ReturnsNull();

        var act = () => _svc.ObtenerCotizacionUsdArsAsync();

        await act.Should().ThrowAsync<ExternalApiException>();
    }
}

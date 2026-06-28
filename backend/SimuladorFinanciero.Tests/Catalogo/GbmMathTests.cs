using FluentAssertions;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Tests.Catalogo;

public class GbmMathTests
{
    // ── LogReturns ────────────────────────────────────────────────────────────

    [Fact]
    public void LogReturns_SerieVacia_DevuelveListaVacia()
    {
        var result = GbmMath.LogReturns([]);
        result.Should().BeEmpty();
    }

    [Fact]
    public void LogReturns_UnSoloPrecio_DevuelveListaVacia()
    {
        var serie = Serie((new DateOnly(2024, 1, 2), 100m));
        GbmMath.LogReturns(serie).Should().BeEmpty();
    }

    [Fact]
    public void LogReturns_DosPreciosNormales_DevuelveRetornoLogaritmico()
    {
        var serie = Serie(
            (new DateOnly(2024, 1, 2), 100m),
            (new DateOnly(2024, 1, 3), 110m));

        var result = GbmMath.LogReturns(serie);

        result.Should().HaveCount(1);
        result[0].Should().BeApproximately(Math.Log(1.1), 1e-10);
    }

    [Fact]
    public void LogReturns_TresPreciosIguales_DevuelveDosRetornosCero()
    {
        var serie = Serie(
            (new DateOnly(2024, 1, 2), 100m),
            (new DateOnly(2024, 1, 3), 100m),
            (new DateOnly(2024, 1, 4), 100m));

        var result = GbmMath.LogReturns(serie);

        result.Should().HaveCount(2).And.AllSatisfy(r => r.Should().BeApproximately(0, 1e-10));
    }

    [Fact]
    public void LogReturns_PrecioCeroEnSerie_OmiteEsePar()
    {
        var serie = Serie(
            (new DateOnly(2024, 1, 2), 100m),
            (new DateOnly(2024, 1, 3), 0m),    // precio inválido
            (new DateOnly(2024, 1, 4), 110m));

        var result = GbmMath.LogReturns(serie);

        // El par (100→0) y (0→110) se omiten: 0 retornos válidos
        result.Should().BeEmpty();
    }

    [Fact]
    public void LogReturns_CincoPreciosCrecientes_DevuelveCuatroRetornos()
    {
        var precios = new[] { 100m, 105m, 102m, 108m, 115m };
        var serie   = precios.Select((p, i) => (new DateOnly(2024, 1, i + 2), p)).ToList();

        var result = GbmMath.LogReturns(serie);

        result.Should().HaveCount(4);
        result[0].Should().BeApproximately(Math.Log(105.0 / 100.0), 1e-10);
        result[3].Should().BeApproximately(Math.Log(115.0 / 108.0), 1e-10);
    }

    // ── Correlacion ───────────────────────────────────────────────────────────

    [Fact]
    public void Correlacion_SeriesVacias_DevuelveCero()
    {
        GbmMath.Correlacion([], []).Should().Be(0);
    }

    [Fact]
    public void Correlacion_SeriesIdenticas_DevuelveUno()
    {
        var x = new List<double> { 1, 2, 3, 4, 5 };
        GbmMath.Correlacion(x, x).Should().BeApproximately(1.0, 1e-10);
    }

    [Fact]
    public void Correlacion_SeriesOpuestas_DevuelveMenosUno()
    {
        var x = new List<double> { 1, 2, 3, 4, 5 };
        var y = new List<double> { 5, 4, 3, 2, 1 };
        GbmMath.Correlacion(x, y).Should().BeApproximately(-1.0, 1e-10);
    }

    [Fact]
    public void Correlacion_SerieConstante_DevuelveCero()
    {
        var x = new List<double> { 1, 2, 3 };
        var y = new List<double> { 5, 5, 5 }; // sin varianza
        GbmMath.Correlacion(x, y).Should().Be(0);
    }

    [Fact]
    public void Correlacion_LongitudesDiferentes_DevuelveCero()
    {
        var x = new List<double> { 1, 2, 3 };
        var y = new List<double> { 1, 2 };
        GbmMath.Correlacion(x, y).Should().Be(0);
    }

    // ── AlinearPorFecha ───────────────────────────────────────────────────────

    [Fact]
    public void AlinearPorFecha_FechasIdenticas_DevuelveAmbosCompletos()
    {
        var fechas  = Fechas(new DateOnly(2024, 1, 2), 4);
        var ticker  = fechas.Select((f, i) => (f, (decimal)(100 + i))).ToList();
        var indice  = fechas.Select((f, i) => (f, (decimal)(200 + i))).ToList();
        var retT    = new List<double> { 0.01, 0.02, 0.03 };
        var retI    = new List<double> { 0.04, 0.05, 0.06 };

        var (aT, aI) = GbmMath.AlinearPorFecha(ticker, indice, retT, retI);

        aT.Should().BeEquivalentTo(retT);
        aI.Should().BeEquivalentTo(retI);
    }

    [Fact]
    public void AlinearPorFecha_IndiceConFechaExtra_SeIgnoraFechaExtra()
    {
        // Ticker: 2 ene, 3 ene, 4 ene
        var ticker = new List<(DateOnly, decimal)>
        {
            (new DateOnly(2024, 1, 2), 100m),
            (new DateOnly(2024, 1, 3), 101m),
            (new DateOnly(2024, 1, 4), 102m)
        };
        // Índice: 2 ene, 3 ene, 4 ene, 5 ene (fecha extra)
        var indice = new List<(DateOnly, decimal)>
        {
            (new DateOnly(2024, 1, 2), 200m),
            (new DateOnly(2024, 1, 3), 201m),
            (new DateOnly(2024, 1, 4), 202m),
            (new DateOnly(2024, 1, 5), 203m)
        };
        var retT = new List<double> { 0.01, 0.02 };
        var retI = new List<double> { 0.03, 0.04, 0.05 };

        var (aT, aI) = GbmMath.AlinearPorFecha(ticker, indice, retT, retI);

        aT.Should().HaveCount(2);
        aI.Should().HaveCount(2);
    }

    [Fact]
    public void AlinearPorFecha_SinFechasComunes_DevuelveListasVacias()
    {
        var ticker = new List<(DateOnly, decimal)>
        {
            (new DateOnly(2024, 1, 2), 100m),
            (new DateOnly(2024, 1, 3), 101m)
        };
        var indice = new List<(DateOnly, decimal)>
        {
            (new DateOnly(2024, 2, 1), 200m),
            (new DateOnly(2024, 2, 2), 201m)
        };
        var retT = new List<double> { 0.01 };
        var retI = new List<double> { 0.02 };

        var (aT, aI) = GbmMath.AlinearPorFecha(ticker, indice, retT, retI);

        aT.Should().BeEmpty();
        aI.Should().BeEmpty();
    }

    // ── CalcularMesesDeDatos ──────────────────────────────────────────────────

    [Fact]
    public void CalcularMesesDeDatos_UnAnio_DevuelveDiez()
    {
        var inicio = new DateOnly(2014, 1, 2);
        var fin    = new DateOnly(2024, 1, 2);
        GbmMath.CalcularMesesDeDatos(inicio, fin).Should().Be(120);
    }

    [Fact]
    public void CalcularMesesDeDatos_UnMes_DevuelveUno()
    {
        var inicio = new DateOnly(2024, 1, 2);
        var fin    = new DateOnly(2024, 2, 2);
        GbmMath.CalcularMesesDeDatos(inicio, fin).Should().Be(1);
    }

    [Fact]
    public void CalcularMesesDeDatos_CuatroAnios_DevuelveCuarentaYOcho()
    {
        var inicio = new DateOnly(2020, 1, 2);
        var fin    = new DateOnly(2024, 1, 2);
        GbmMath.CalcularMesesDeDatos(inicio, fin).Should().Be(48);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static List<(DateOnly Fecha, decimal PrecioAjustado)> Serie(
        params (DateOnly Fecha, decimal Precio)[] puntos) => [.. puntos];

    private static List<DateOnly> Fechas(DateOnly inicio, int count) =>
        Enumerable.Range(0, count).Select(i => inicio.AddDays(i)).ToList();
}

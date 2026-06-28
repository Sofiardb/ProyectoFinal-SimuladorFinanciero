using FluentAssertions;
using SimuladorFinanciero.Api.Services.BackgroundJobs;

namespace SimuladorFinanciero.Tests.Catalogo;

public class CatalogoRefreshJobTests
{
    private static readonly TimeZoneInfo Art =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    private static readonly TimeOnly Hora1130 = new(11, 30);

    // Convierte una fecha y hora local ART a UTC
    private static DateTime ArtToUtc(int year, int month, int day, int hour, int minute) =>
        TimeZoneInfo.ConvertTimeToUtc(new DateTime(year, month, day, hour, minute, 0), Art);

    [Fact]
    public void CalcularDemora_HoraNoHaPasadoHoy_DevuelveDemoraHastaHoy()
    {
        // Lunes 09:00 ART → faltan 2:30 para las 11:30
        var ahora = ArtToUtc(2024, 6, 3, 9, 0); // lunes

        var demora = CatalogoRefreshJob.CalcularDemora(ahora, Hora1130, Art);

        demora.Should().BeCloseTo(TimeSpan.FromMinutes(150), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void CalcularDemora_HoraYaPasoHoyEnDiaHabil_ProgramaParaManianaHabil()
    {
        // Lunes 14:00 ART → la hora 11:30 ya pasó → próxima es martes 11:30
        var ahora = ArtToUtc(2024, 6, 3, 14, 0); // lunes

        var demora = CatalogoRefreshJob.CalcularDemora(ahora, Hora1130, Art);

        demora.Should().BeCloseTo(TimeSpan.FromHours(21.5), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void CalcularDemora_ViernesDepuesHoraEjecucion_ProgramaParaLunes()
    {
        // Viernes 14:00 ART → próxima ejecución es lunes 11:30 (≈ 69.5 horas)
        var ahora = ArtToUtc(2024, 6, 7, 14, 0); // viernes

        var demora = CatalogoRefreshJob.CalcularDemora(ahora, Hora1130, Art);

        // De viernes 14:00 a lunes 11:30 = 2 días + 21.5 horas = 69.5 horas
        demora.Should().BeCloseTo(TimeSpan.FromHours(69.5), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void CalcularDemora_Sabado_ProgramaParaLunes()
    {
        // Sábado 10:00 ART → próxima ejecución es lunes 11:30
        var ahora = ArtToUtc(2024, 6, 8, 10, 0); // sábado

        var demora = CatalogoRefreshJob.CalcularDemora(ahora, Hora1130, Art);

        // De sábado 10:00 a lunes 11:30 = 1 día + 25.5 horas = 49.5 horas
        demora.Should().BeCloseTo(TimeSpan.FromHours(49.5), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void CalcularDemora_Domingo_ProgramaParaLunes()
    {
        // Domingo 10:00 ART → próxima ejecución es lunes 11:30
        var ahora = ArtToUtc(2024, 6, 9, 10, 0); // domingo

        var demora = CatalogoRefreshJob.CalcularDemora(ahora, Hora1130, Art);

        // De domingo 10:00 a lunes 11:30 = 25.5 horas
        demora.Should().BeCloseTo(TimeSpan.FromHours(25.5), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void CalcularDemora_DemoraSiemprePositiva()
    {
        var ahora = ArtToUtc(2024, 6, 7, 23, 59); // viernes casi medianoche
        CatalogoRefreshJob.CalcularDemora(ahora, Hora1130, Art).Should().BePositive();
    }
}

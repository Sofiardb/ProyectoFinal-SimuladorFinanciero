namespace SimuladorFinanciero.Api.Services.Catalogo;

internal static class GbmMath
{
    internal static List<double> LogReturns(List<(DateOnly Fecha, decimal PrecioAjustado)> serie)
    {
        var result = new List<double>(Math.Max(0, serie.Count - 1));
        for (int i = 1; i < serie.Count; i++)
        {
            if (serie[i - 1].PrecioAjustado <= 0 || serie[i].PrecioAjustado <= 0) continue;
            result.Add(Math.Log((double)(serie[i].PrecioAjustado / serie[i - 1].PrecioAjustado)));
        }
        return result;
    }

    internal static double Correlacion(List<double> x, List<double> y)
    {
        if (x.Count != y.Count || x.Count == 0) return 0;
        double mx = x.Average(), my = y.Average();
        double num = x.Zip(y).Sum(p => (p.First - mx) * (p.Second - my));
        double dx  = Math.Sqrt(x.Sum(v => Math.Pow(v - mx, 2)));
        double dy  = Math.Sqrt(y.Sum(v => Math.Pow(v - my, 2)));
        return (dx == 0 || dy == 0) ? 0 : num / (dx * dy);
    }

    /// <summary>
    /// Estima los parámetros anuales del GBM a partir de retornos logarítmicos diarios.
    /// Por el lema de Itô, ln S tiene drift ν = μ − σ²/2: la media de los retornos log estima ν
    /// (la tasa de crecimiento de la mediana), no μ. Como el motor espera μ y él mismo resta σ²/2,
    /// acá se devuelve μ = ν + σ²/2; si no, la corrección de Itô se aplicaría dos veces.
    /// </summary>
    internal static (double MuAnual, double SigmaAnual) EstimarParametrosAnuales(
        IReadOnlyList<double> retornosLogDiarios, int diasPorAnio)
    {
        double mediaDiaria = retornosLogDiarios.Average();
        double varianza    = retornosLogDiarios.Select(r => Math.Pow(r - mediaDiaria, 2)).Average();
        double sigmaAnual  = Math.Sqrt(varianza * diasPorAnio);
        double nuAnual     = mediaDiaria * diasPorAnio;
        return (nuAnual + sigmaAnual * sigmaAnual / 2, sigmaAnual);
    }

    internal static (List<double> Ticker, List<double> Indice) AlinearPorFecha(
        List<(DateOnly Fecha, decimal Precio)> serieTicker,
        List<(DateOnly Fecha, decimal Precio)> serieIndice,
        List<double> retTicker,
        List<double> retIndice)
    {
        var fechasTicker = serieTicker.Skip(1).Select(p => p.Fecha).ToList();
        var fechasIndice = serieIndice.Skip(1).Select(p => p.Fecha).ToList();

        var indicePorFecha = fechasIndice.Zip(retIndice).ToDictionary(x => x.First, x => x.Second);

        var alineadoTicker = new List<double>();
        var alineadoIndice = new List<double>();

        for (int i = 0; i < fechasTicker.Count && i < retTicker.Count; i++)
        {
            if (!indicePorFecha.TryGetValue(fechasTicker[i], out var ri)) continue;
            alineadoTicker.Add(retTicker[i]);
            alineadoIndice.Add(ri);
        }

        return (alineadoTicker, alineadoIndice);
    }

    internal static int CalcularMesesDeDatos(DateOnly inicio, DateOnly fin) =>
        (int)Math.Round(
            (fin.ToDateTime(TimeOnly.MinValue) - inicio.ToDateTime(TimeOnly.MinValue))
            .TotalDays / 30.44);
}

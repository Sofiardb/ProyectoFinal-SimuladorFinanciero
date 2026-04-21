using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace MonteCarloPilot
{
    /// <summary>
    /// Carga y procesa datos históricos de acciones desde JSON.
    /// Calcula retorno esperado (μ) y volatilidad (σ).
    /// </summary>
    public class DatosAccionesLoader
    {
        private readonly JsonElement _data;
        private readonly string _symbol;
        private readonly Dictionary<string, JsonElement> _timeSeries;

        public DatosAccionesLoader(string jsonPath)
        {
            var json = File.ReadAllText(jsonPath);
            _data = JsonSerializer.Deserialize<JsonElement>(json);

            _symbol = _data.GetProperty("Meta Data")
                .GetProperty("2. Symbol")
                .GetString() ?? "UNKNOWN";

            _timeSeries = new Dictionary<string, JsonElement>();
            var ts = _data.GetProperty("Time Series (Daily)");
            foreach (var prop in ts.EnumerateObject())
            {
                _timeSeries[prop.Name] = prop.Value;
            }
        }

        public string Symbol => _symbol;

        public List<(string Fecha, Dictionary<string, double> Datos)> GetSerieOrdenada()
        {
            var serie = new List<(string, Dictionary<string, double>)>();

            foreach (var fecha in _timeSeries.Keys.OrderBy(f => f))
            {
                var entry = _timeSeries[fecha];
                var datos = new Dictionary<string, double>
                {
                    { "open", double.Parse(entry.GetProperty("1. open").GetString() ?? "0", CultureInfo.InvariantCulture) },
                    { "high", double.Parse(entry.GetProperty("2. high").GetString() ?? "0", CultureInfo.InvariantCulture) },
                    { "low", double.Parse(entry.GetProperty("3. low").GetString() ?? "0", CultureInfo.InvariantCulture) },
                    { "close", double.Parse(entry.GetProperty("4. close").GetString() ?? "0", CultureInfo.InvariantCulture) },
                    { "volume", double.Parse(entry.GetProperty("5. volume").GetString() ?? "0", CultureInfo.InvariantCulture) }
                };
                serie.Add((fecha, datos));
            }

            return serie;
        }

        public List<double> CalcularRetornosLogaritmicos(int nDiasAtras = 2520)
        {
            var serie = GetSerieOrdenada();

            if (serie.Count < nDiasAtras)
            {
                Console.WriteLine($"Advertencia: Se tienen {serie.Count} días, se solicitaron {nDiasAtras}");
                nDiasAtras = serie.Count;
            }

            serie = serie.Skip(serie.Count - nDiasAtras).ToList();

            var retornos = new List<double>();
            for (int i = 1; i < serie.Count; i++)
            {
                var precioPrev = serie[i - 1].Datos["close"];
                var precioActual = serie[i].Datos["close"];

                if (precioPrev > 0)
                {
                    var retornoLog = Math.Log(precioActual / precioPrev);
                    retornos.Add(retornoLog);
                }
            }

            return retornos;
        }

        public (double mu, double sigma) CalcularParametrosGBM(int nDiasAtras = 2520)
        {
            var retornos = CalcularRetornosLogaritmicos(nDiasAtras);

            if (retornos.Count == 0)
                return (0.0, 0.0);

            // Media de retornos diarios
            var mediaDiaria = retornos.Average();

            // Varianza y desviación estándar
            var varianzaDiaria = retornos.Sum(r => Math.Pow(r - mediaDiaria, 2)) / retornos.Count;
            var volatilidadDiaria = Math.Sqrt(varianzaDiaria);

            // Anualización (252 días de trading por año)
            var muAnual = mediaDiaria * 252;
            var sigmaAnual = volatilidadDiaria * Math.Sqrt(252);

            return (muAnual, sigmaAnual);
        }

        public double GetPrecioInicial()
        {
            var serie = GetSerieOrdenada();
            return serie.Count > 0 ? serie[^1].Datos["close"] : 0.0;
        }
    }
}

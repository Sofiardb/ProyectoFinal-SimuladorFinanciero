using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace MonteCarloPilot
{
    /// <summary>
    /// Simulación Monte Carlo en C# para acciones usando GBM.
    /// S(t+1) = S(t) * exp((μ - 0.5σ²)Δt + σ√Δt * Z)
    /// </summary>
    public class MonteCarloSimulator
    {
        private readonly double _S0;     // Precio inicial
        private readonly double _mu;     // Retorno esperado anual
        private readonly double _sigma;  // Volatilidad anual
        private readonly Random _random;

        public MonteCarloSimulator(double S0, double mu, double sigma)
        {
            _S0 = S0;
            _mu = mu;
            _sigma = sigma;
            _random = new Random();
        }

        /// <summary>
        /// Simula una trayectoria del precio para un número de acciones.
        /// </summary>
        public double SimularTrayectoria(int T, int pasos, int numAcciones)
        {
            double dt = (double)T / pasos;
            double precio = _S0;

            for (int i = 0; i < pasos; i++)
            {
                // Número aleatorio normal estándar (Box-Muller)
                double Z = ObtenerNormalEstandar();

                // GBM: S(t+1) = S(t) * exp((μ - 0.5σ²)Δt + σ√Δt * Z)
                precio *= Math.Exp((_mu - 0.5 * _sigma * _sigma) * dt + _sigma * Math.Sqrt(dt) * Z);
            }

            return precio * numAcciones;
        }

        /// <summary>
        /// Genera un número aleatorio de la distribución normal estándar (Box-Muller).
        /// </summary>
        private double ObtenerNormalEstandar()
        {
            double u1 = _random.NextDouble();
            double u2 = _random.NextDouble();

            // Box-Muller transform
            return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
        }

        /// <summary>
        /// Ejecuta simulación Monte Carlo con numSimulaciones trayectorias.
        /// </summary>
        public Dictionary<string, double> SimularMonteCarlo(int T, int pasos, int numAcciones, int numSimulaciones)
        {
            var resultados = new List<double>(numSimulaciones);

            for (int i = 0; i < numSimulaciones; i++)
            {
                double valorFinal = SimularTrayectoria(T, pasos, numAcciones);
                resultados.Add(valorFinal);
            }

            resultados.Sort();

            double retornoEsperado = resultados.Average();
            double minValor = resultados[0];
            double maxValor = resultados[^1];
            double percentil5 = resultados[(int)(resultados.Count * 0.05)];
            double percentil95 = resultados[(int)(resultados.Count * 0.95)];

            double varianza = resultados.Sum(r => Math.Pow(r - retornoEsperado, 2)) / resultados.Count;
            double volatilidad = Math.Sqrt(varianza);

            return new Dictionary<string, double>
            {
                { "retorno_esperado", retornoEsperado },
                { "min", minValor },
                { "max", maxValor },
                { "volatilidad", volatilidad },
                { "percentil_5", percentil5 },
                { "percentil_95", percentil95 }
            };
        }
    }
}

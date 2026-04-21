// Piloto C# ESCALABLE - Simulación de N empresas con correlaciones
// Reutiliza los mismos datos históricos para simular múltiples empresas
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace MonteCarloPilot
{
    public class Empresa
    {
        public string Nombre { get; set; }
        public double Mu { get; set; }
        public double Sigma { get; set; }
        public double S0 { get; set; }
        public double Rho { get; set; }  // Correlación con índice de mercado
        public int Cantidad { get; set; }  // Cantidad de acciones a invertir
    }

    public class MonteCarloSimulatorMulti
    {
        private readonly List<Empresa> _empresas;

        public MonteCarloSimulatorMulti(List<Empresa> empresas)
        {
            _empresas = empresas;
        }

        private static double ObtenerNormalEstandar(Random rng)
        {
            // Box-Muller transform: avoid log(0) by using NextDouble which excludes 0
            double u1 = 1.0 - rng.NextDouble();
            double u2 = rng.NextDouble();
            return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
        }

        public Dictionary<string, double> SimularMonteCarlo(int T, int pasos, int numSimulaciones)
        {
            double dt = (double)T / pasos;
            double sqrtDt = Math.Sqrt(dt);
            int nEmpresas = _empresas.Count;
            var valoresPortafolio = new double[numSimulaciones];

            // Precalcular constantes por empresa (evitar recalcular en el loop interno)
            var drifts = new double[nEmpresas];
            var diffusions = new double[nEmpresas];
            var rhos = new double[nEmpresas];
            var sqrtRho2s = new double[nEmpresas];
            var s0s = new double[nEmpresas];
            var cantidades = new int[nEmpresas];

            for (int e = 0; e < nEmpresas; e++)
            {
                var emp = _empresas[e];
                drifts[e] = (emp.Mu - 0.5 * emp.Sigma * emp.Sigma) * dt;
                diffusions[e] = emp.Sigma * sqrtDt;
                rhos[e] = emp.Rho;
                sqrtRho2s[e] = Math.Sqrt(1.0 - emp.Rho * emp.Rho);
                s0s[e] = emp.S0;
                cantidades[e] = emp.Cantidad;
            }

            // Simulación paralela con Random thread-local (equivalente al NumPy vectorizado)
            Parallel.For<(Random rng, double[] zIndices)>(
                0, numSimulaciones,
                () => (new Random(Guid.NewGuid().GetHashCode()), new double[pasos]),
                (sim, state, local) =>
                {
                    var (rng, zIndices) = local;

                    // Factor de mercado por paso, compartido entre TODAS las empresas
                    // Equivalente a Z_indice = np.random.standard_normal((num_sim, pasos)) en Python
                    for (int paso = 0; paso < pasos; paso++)
                        zIndices[paso] = ObtenerNormalEstandar(rng);

                    double valorPortafolioSim = 0;
                    for (int e = 0; e < nEmpresas; e++)
                    {
                        double precio = s0s[e];
                        for (int paso = 0; paso < pasos; paso++)
                        {
                            // Variable idiosincrática de la empresa
                            double zPropio = ObtenerNormalEstandar(rng);

                            // Z_accion = ρ * Z_indice + √(1-ρ²) * Z_propio
                            double zAccion = rhos[e] * zIndices[paso] + sqrtRho2s[e] * zPropio;

                            // GBM paso a paso
                            precio *= Math.Exp(drifts[e] + diffusions[e] * zAccion);
                        }
                        valorPortafolioSim += precio * cantidades[e];
                    }

                    valoresPortafolio[sim] = valorPortafolioSim;
                    return local;
                },
                _ => { });

            Array.Sort(valoresPortafolio);

            double retornoEsperado = valoresPortafolio.Average();
            double varianza = valoresPortafolio.Sum(v => Math.Pow(v - retornoEsperado, 2)) / valoresPortafolio.Length;

            return new Dictionary<string, double>
            {
                { "retorno_esperado", retornoEsperado },
                { "min", valoresPortafolio[0] },
                { "max", valoresPortafolio[^1] },
                { "volatilidad", Math.Sqrt(varianza) },
                { "percentil_5", valoresPortafolio[(int)(valoresPortafolio.Length * 0.05)] },
                { "percentil_95", valoresPortafolio[(int)(valoresPortafolio.Length * 0.95)] }
            };
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine(new string('=', 70));
            Console.WriteLine("PILOTO C# ESCALABLE - Múltiples Empresas con Correlaciones");
            Console.WriteLine(new string('=', 70));

            string jsonPath = FindDataFile("DatosAccionesDiaria.json");
            if (!File.Exists(jsonPath))
            {
                Console.WriteLine($"ERROR: No se encontró {jsonPath}");
                return;
            }

            var loader = new DatosAccionesLoader(jsonPath);
            var (mu, sigma) = loader.CalcularParametrosGBM();
            var S0 = loader.GetPrecioInicial();

            int numEmpresas = args.Length > 0 ? int.Parse(args[0]) : 1;
            int T = 1;
            int pasos = 12;
            int numSimulaciones = 10000;

            Console.WriteLine($"\n--- Configuración ---");
            Console.WriteLine($"Número de empresas: {numEmpresas}");
            Console.WriteLine($"Simulaciones: {numSimulaciones}");
            Console.WriteLine($"Pasos: {pasos}");
            Console.WriteLine($"Datos históricos: {loader.Symbol} (reutilizados)");
            Console.WriteLine($"Threads disponibles: {Environment.ProcessorCount}");

            var empresas = new List<Empresa>();
            for (int i = 0; i < numEmpresas; i++)
            {
                double muVariada = mu + (0.005 * (i % 3 - 1));
                double rhoVariada = 0.5 + (0.1 * (i % 3 - 1));

                empresas.Add(new Empresa
                {
                    Nombre = $"Empresa_{i + 1}",
                    Mu = muVariada,
                    Sigma = sigma,
                    S0 = S0,
                    Rho = rhoVariada,
                    Cantidad = 100
                });
            }

            Console.WriteLine($"\n--- Parámetros por Empresa ---");
            foreach (var emp in empresas)
                Console.WriteLine($"{emp.Nombre}: μ={emp.Mu:F4} σ={emp.Sigma:F4} ρ={emp.Rho:F2}");

            var mc = new MonteCarloSimulatorMulti(empresas);

            var stopwatch = Stopwatch.StartNew();
            var resultados = mc.SimularMonteCarlo(T, pasos, numSimulaciones);
            stopwatch.Stop();

            Console.WriteLine($"\n--- Resultados Portafolio ---");
            Console.WriteLine($"Retorno esperado: ${resultados["retorno_esperado"]:F2}");
            Console.WriteLine($"Mínimo: ${resultados["min"]:F2}");
            Console.WriteLine($"Máximo: ${resultados["max"]:F2}");
            Console.WriteLine($"Volatilidad: {resultados["volatilidad"]:F2}");
            Console.WriteLine($"P5: ${resultados["percentil_5"]:F2}");
            Console.WriteLine($"P95: ${resultados["percentil_95"]:F2}");

            Console.WriteLine($"\n--- Performance ---");
            Console.WriteLine($"Tiempo total: {stopwatch.Elapsed.TotalSeconds:F4}s");
            Console.WriteLine($"Tiempo/simulación: {(stopwatch.Elapsed.TotalMilliseconds / numSimulaciones):F6}ms");
            Console.WriteLine($"Tiempo/empresa/simulación: {(stopwatch.Elapsed.TotalMilliseconds / (numSimulaciones * numEmpresas)):F6}ms");
        }

        static string FindDataFile(string filename)
        {
            string[] searchPaths = new[]
            {
                Path.Combine(Directory.GetCurrentDirectory(), filename),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, filename),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", filename),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", filename),
            };

            foreach (var path in searchPaths)
            {
                string fullPath = Path.GetFullPath(path);
                if (File.Exists(fullPath))
                    return fullPath;
            }

            return searchPaths[0];
        }
    }
}

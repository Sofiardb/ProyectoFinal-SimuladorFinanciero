// Piloto C# -- loop secuencial de instrumentos + funcion pura por instrumento,
// replicando la arquitectura real de motor-simulacion/app/simulacion/orquestador.py
// (nunca batchea instrumentos; simula uno a la vez, con z_indice compartido).
using System;
using System.Diagnostics;
using System.Globalization;

namespace MonteCarloPilot
{
    class Program
    {
        // Mismos parametros historicos que documenta el informe (Seccion 2.1) -- ahora
        // llegan como constantes, no se recalculan de un JSON en cada corrida (igual que
        // en produccion, donde mu/sigma se cachean aparte del request).
        const double MuBase = 0.0528;
        const double SigmaBase = 0.2583;
        const double MontoPorInstrumento = 100000.0;

        static void Main(string[] args)
        {
            Console.WriteLine(new string('=', 70));
            Console.WriteLine("PILOTO C# -- loop secuencial de instrumentos + funcion pura");
            Console.WriteLine(new string('=', 70));

            int numInstrumentos = args.Length > 0 ? int.Parse(args[0]) : 1;
            string variante = args.Length > 1 ? args[1] : "parallel"; // "for" | "parallel"
            int numSimulaciones = args.Length > 2 ? int.Parse(args[2]) : 3000;
            int tMeses = 12;
            bool paralelo = variante == "parallel";

            Console.WriteLine($"\n--- Configuracion ---");
            Console.WriteLine($"Instrumentos: {numInstrumentos}");
            Console.WriteLine($"Simulaciones: {numSimulaciones}");
            Console.WriteLine($"Meses: {tMeses}");
            Console.WriteLine($"Variante: {(paralelo ? "Parallel.For" : "for secuencial")}");
            Console.WriteLine($"Threads disponibles: {Environment.ProcessorCount}");

            var rng = new Random(12345);
            var stopwatch = Stopwatch.StartNew();

            double[][] zIndice = paralelo
                ? GeneradorShocks.GenerarZIndiceParalelo(numSimulaciones, tMeses)
                : GeneradorShocks.GenerarZIndiceSecuencial(numSimulaciones, tMeses, rng);

            double valorPortfolioEsperado = 0.0;

            for (int i = 0; i < numInstrumentos; i++)
            {
                double mu = MuBase + 0.005 * ((i % 3) - 1);
                double rho = 0.5 + 0.1 * ((i % 3) - 1);

                double[][] zAccion = paralelo
                    ? GeneradorShocks.GenerarZAccionParalelo(rho, zIndice)
                    : GeneradorShocks.GenerarZAccionSecuencial(rho, zIndice, rng);

                double[][] trayectorias = paralelo
                    ? AccionSimulador.SimularParalelo(MontoPorInstrumento, mu, SigmaBase, tMeses, zAccion)
                    : AccionSimulador.SimularSecuencial(MontoPorInstrumento, mu, SigmaBase, tMeses, zAccion);

                double sumaFinal = 0.0;
                for (int s = 0; s < numSimulaciones; s++)
                    sumaFinal += trayectorias[s][tMeses];
                valorPortfolioEsperado += sumaFinal / numSimulaciones;
            }

            stopwatch.Stop();

            Console.WriteLine($"\n--- Resultado ---");
            Console.WriteLine($"Valor esperado del portfolio: ${valorPortfolioEsperado:F2}");

            Console.WriteLine($"\n--- Performance ---");
            Console.WriteLine($"Tiempo total: {stopwatch.Elapsed.TotalSeconds.ToString("F4", CultureInfo.InvariantCulture)}s");
        }
    }
}

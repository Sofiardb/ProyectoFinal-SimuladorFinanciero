using System;
using System.Threading.Tasks;

namespace MonteCarloPilot
{
    // Funcion pura por instrumento: misma formula que acciones.simular_accion_vectorizado()
    // de motor-simulacion (retornoLog = (mu - 0.5*sigma^2)/12 + sigma/sqrt(12)*z, acumulado,
    // monto*exp(acumulado)). Recibe z_accion ya generado -- no genera aleatorios.
    public static class AccionSimulador
    {
        public static double[][] SimularSecuencial(double monto, double mu, double sigma, int tMeses, double[][] zAccion)
        {
            int n = zAccion.Length;
            var trayectorias = new double[n][];
            for (int sim = 0; sim < n; sim++)
                trayectorias[sim] = SimularUnaTrayectoria(monto, mu, sigma, tMeses, zAccion[sim]);
            return trayectorias;
        }

        public static double[][] SimularParalelo(double monto, double mu, double sigma, int tMeses, double[][] zAccion)
        {
            int n = zAccion.Length;
            var trayectorias = new double[n][];
            Parallel.For(0, n, sim =>
            {
                trayectorias[sim] = SimularUnaTrayectoria(monto, mu, sigma, tMeses, zAccion[sim]);
            });
            return trayectorias;
        }

        private static double[] SimularUnaTrayectoria(double monto, double mu, double sigma, int tMeses, double[] zFila)
        {
            var trayectoria = new double[tMeses + 1];
            trayectoria[0] = monto;

            double drift = (mu - 0.5 * sigma * sigma) / 12.0;
            double difusion = sigma / Math.Sqrt(12.0);
            double acumulado = 0.0;

            for (int t = 0; t < tMeses; t++)
            {
                acumulado += drift + difusion * zFila[t];
                trayectoria[t + 1] = monto * Math.Exp(acumulado);
            }

            return trayectoria;
        }

        // Box-Muller sobre un Random dado -- reusado tanto por el generador secuencial
        // (con un Random sembrado) como por el paralelo (con Random.Shared).
        public static double ObtenerNormalEstandar(Random rng)
        {
            double u1 = 1.0 - rng.NextDouble();
            double u2 = rng.NextDouble();
            return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
        }
    }
}

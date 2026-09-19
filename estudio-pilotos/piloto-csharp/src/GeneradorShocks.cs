using System;
using System.Threading.Tasks;

namespace MonteCarloPilot
{
    // Genera z_indice (factor de mercado, compartido entre instrumentos) y z_accion
    // (z_indice combinado con el shock idiosincratico de un instrumento via rho) --
    // mismos dos pasos que orquestador.simular_portfolio() antes de llamar a la
    // funcion pura de simulacion.
    public static class GeneradorShocks
    {
        public static double[][] GenerarZIndiceSecuencial(int nSim, int tMeses, Random rng)
        {
            var z = new double[nSim][];
            for (int i = 0; i < nSim; i++)
            {
                var fila = new double[tMeses];
                for (int t = 0; t < tMeses; t++)
                    fila[t] = AccionSimulador.ObtenerNormalEstandar(rng);
                z[i] = fila;
            }
            return z;
        }

        public static double[][] GenerarZIndiceParalelo(int nSim, int tMeses)
        {
            var z = new double[nSim][];
            Parallel.For(0, nSim, i =>
            {
                var fila = new double[tMeses];
                for (int t = 0; t < tMeses; t++)
                    fila[t] = AccionSimulador.ObtenerNormalEstandar(Random.Shared);
                z[i] = fila;
            });
            return z;
        }

        public static double[][] GenerarZAccionSecuencial(double rho, double[][] zIndice, Random rng)
        {
            int n = zIndice.Length;
            double sqrtRho2 = Math.Sqrt(1.0 - rho * rho);
            var zAccion = new double[n][];
            for (int i = 0; i < n; i++)
            {
                int t = zIndice[i].Length;
                var fila = new double[t];
                for (int j = 0; j < t; j++)
                {
                    double zPropio = AccionSimulador.ObtenerNormalEstandar(rng);
                    fila[j] = rho * zIndice[i][j] + sqrtRho2 * zPropio;
                }
                zAccion[i] = fila;
            }
            return zAccion;
        }

        public static double[][] GenerarZAccionParalelo(double rho, double[][] zIndice)
        {
            int n = zIndice.Length;
            double sqrtRho2 = Math.Sqrt(1.0 - rho * rho);
            var zAccion = new double[n][];
            Parallel.For(0, n, i =>
            {
                int t = zIndice[i].Length;
                var fila = new double[t];
                for (int j = 0; j < t; j++)
                {
                    double zPropio = AccionSimulador.ObtenerNormalEstandar(Random.Shared);
                    fila[j] = rho * zIndice[i][j] + sqrtRho2 * zPropio;
                }
                zAccion[i] = fila;
            });
            return zAccion;
        }
    }
}

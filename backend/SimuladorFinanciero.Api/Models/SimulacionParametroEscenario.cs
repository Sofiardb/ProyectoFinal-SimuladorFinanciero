namespace SimuladorFinanciero.Api.Models;

public class SimulacionParametroEscenario
{
    public long    IdSimulacion        { get; set; }
    public int     IdTipoEscenario     { get; set; }
    public decimal InflacionMensualMin { get; set; }
    public decimal InflacionMensualMax { get; set; }
}

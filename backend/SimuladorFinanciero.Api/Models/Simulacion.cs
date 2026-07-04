namespace SimuladorFinanciero.Api.Models;

public class Simulacion
{
    public long           IdSimulacion       { get; set; }
    public long           IdPortfolio        { get; set; }
    public DateTimeOffset FechaEjecucion     { get; set; }
    public int            HorizonteMeses     { get; set; }
    public int            NumTrayectorias    { get; set; }
    public long           SeedAleatoria      { get; set; }
    public decimal        ValorInicial       { get; set; }
    public decimal?       ValorEsperado      { get; set; }
    public decimal?       ValorMinimo        { get; set; }
    public decimal?       ValorMaximo        { get; set; }
    public decimal?       RetornoEsperadoPct { get; set; }
    public decimal?       RendimientoRealPct { get; set; }
    public decimal?       DesvioEstandar     { get; set; }
    public string?        Observaciones      { get; set; }
}

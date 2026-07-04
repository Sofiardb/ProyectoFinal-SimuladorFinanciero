namespace SimuladorFinanciero.Api.Models;

public class ResultadoSimulacion
{
    public long   IdResultado  { get; set; }
    public long   IdSimulacion { get; set; }
    public string Ambito       { get; set; } = "";
    public string Escenario    { get; set; } = "";
    public string Metrica      { get; set; } = "";
}

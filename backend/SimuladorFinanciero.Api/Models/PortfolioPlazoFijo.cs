namespace SimuladorFinanciero.Api.Models;

public class PortfolioPlazoFijo
{
    public long     IdPortfolioPlazoFijo    { get; set; }
    public long     IdPortfolio             { get; set; }
    public int      IdTipoPlazoFijo         { get; set; }
    public int      IdMoneda                { get; set; }
    public string   EntidadFinanciera       { get; set; } = "";
    public decimal  MontoInvertido          { get; set; }
    public decimal  TnaPactada             { get; set; }
    public DateOnly FechaInicio             { get; set; }
    public int      DuracionDias           { get; set; }
    public bool     ReinvertirAlVencimiento { get; set; }
}

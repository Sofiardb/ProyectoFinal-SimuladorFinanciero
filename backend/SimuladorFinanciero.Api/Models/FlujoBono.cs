namespace SimuladorFinanciero.Api.Models;

public class FlujoBono
{
    public long    IdFlujoBono      { get; set; }
    public long    IdBono           { get; set; }
    public short   NumeroCupon      { get; set; }
    public DateOnly FechaPago       { get; set; }
    public decimal MontoCupon       { get; set; }
    public bool    AmortizaCapital  { get; set; }
    public decimal MontoCapital     { get; set; }
}

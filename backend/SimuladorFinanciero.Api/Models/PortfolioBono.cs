namespace SimuladorFinanciero.Api.Models;

public class PortfolioBono
{
    public long    IdPortfolioBono { get; set; }
    public long    IdPortfolio     { get; set; }
    public long    IdBono          { get; set; }
    public decimal Cantidad        { get; set; }
    public decimal PrecioCompra    { get; set; }
    public decimal TasaDescuentoCompra { get; set; }
}

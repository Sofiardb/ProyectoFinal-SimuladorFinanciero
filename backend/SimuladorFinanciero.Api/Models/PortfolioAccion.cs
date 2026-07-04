namespace SimuladorFinanciero.Api.Models;

public class PortfolioAccion
{
    public long    IdPortfolioAccion { get; set; }
    public long    IdPortfolio       { get; set; }
    public long    IdAccion          { get; set; }
    public decimal Cantidad          { get; set; }
    public decimal PrecioCompra      { get; set; }
}

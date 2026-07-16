namespace SimuladorFinanciero.Api.Models;

public class PortfolioLetra
{
    public long    IdPortfolioLetra { get; set; }
    public long    IdPortfolio      { get; set; }
    public long    IdLetra          { get; set; }
    public decimal Cantidad         { get; set; }
    public decimal PrecioCompra     { get; set; }
    public decimal TasaCompra       { get; set; }
}

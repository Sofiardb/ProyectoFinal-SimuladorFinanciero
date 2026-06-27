namespace SimuladorFinanciero.Api.Models;

public class Accion
{
    public long    IdAccion                { get; set; }
    public string  Ticker                  { get; set; } = "";
    public string  Nombre                  { get; set; } = "";
    public string? Sector                  { get; set; }
    public short   IdIndiceMercado         { get; set; }
    public short   IdMoneda                { get; set; }
    public decimal? MuRetornoEsperado      { get; set; }
    public decimal? SigmaVolatilidad       { get; set; }
    public decimal? RhoCorrelacionIndice   { get; set; }
    public decimal? PrecioActual           { get; set; }
    public DateTimeOffset? FechaPrecioActual      { get; set; }
    public DateTimeOffset? FechaEstimacionParams  { get; set; }
    public bool    Activo                  { get; set; }
}

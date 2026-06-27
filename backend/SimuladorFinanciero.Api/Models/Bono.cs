namespace SimuladorFinanciero.Api.Models;

public class Bono
{
    public long    IdBono                 { get; set; }
    public string  Ticker                 { get; set; } = "";
    public string  Nombre                 { get; set; } = "";
    public string? Emisor                 { get; set; }
    public short   IdTipoBono             { get; set; }
    public short   IdMoneda               { get; set; }
    public decimal ValorNominal           { get; set; }
    public decimal Cupon                  { get; set; }
    public short   FrecuenciaCuponMeses   { get; set; }
    public decimal TasaDescuento          { get; set; }
    public DateOnly FechaEmision          { get; set; }
    public DateOnly FechaVencimiento      { get; set; }
    public decimal? PrecioActual          { get; set; }
    public DateTimeOffset? FechaPrecioActual { get; set; }
    public bool    Activo                 { get; set; }
}

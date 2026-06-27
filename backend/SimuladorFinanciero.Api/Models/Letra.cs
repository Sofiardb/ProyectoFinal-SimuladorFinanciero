namespace SimuladorFinanciero.Api.Models;

public class Letra
{
    public long    IdLetra            { get; set; }
    public string  Ticker             { get; set; } = "";
    public string  Nombre             { get; set; } = "";
    public string? Emisor             { get; set; }
    public short   IdTipoLetra        { get; set; }
    public short   IdMoneda           { get; set; }
    public decimal ValorNominal       { get; set; }
    public decimal Tasa               { get; set; }
    public DateOnly FechaEmision      { get; set; }
    public DateOnly FechaVencimiento  { get; set; }
    public decimal? PrecioActual      { get; set; }
    public DateTimeOffset? FechaPrecioActual { get; set; }
    public bool    Activo             { get; set; }
}

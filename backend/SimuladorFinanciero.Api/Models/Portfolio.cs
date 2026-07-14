namespace SimuladorFinanciero.Api.Models;

public class Portfolio
{
    public long    IdPortfolio       { get; set; }
    public long    IdUsuario         { get; set; }
    public int     IdPerfilRiesgo    { get; set; }
    public int     IdMonedaBase      { get; set; }
    public string  CodigoMonedaBase  { get; set; } = "";
    public string  Nombre            { get; set; } = "";
    public string? Descripcion       { get; set; }
    public decimal? CapitalInicial   { get; set; }
    public int     HorizonteMeses    { get; set; }
    public DateTimeOffset FechaCreacion     { get; set; }
    public DateTimeOffset FechaModificacion { get; set; }
    public string  Estado            { get; set; } = "ACTIVO";
}

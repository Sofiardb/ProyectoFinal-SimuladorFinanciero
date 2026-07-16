using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Portfolio;

public sealed class CrearPortfolioRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Nombre { get; init; } = "";

    [StringLength(500)]
    public string? Descripcion { get; init; }

    [Range(1, 32767, ErrorMessage = "IdPerfilRiesgo debe ser un valor válido.")]
    public int IdPerfilRiesgo { get; init; }

    [Range(1, 32767, ErrorMessage = "IdMonedaBase debe ser un valor válido.")]
    public int IdMonedaBase { get; init; }

    [Range(0.000001, double.MaxValue, ErrorMessage = "El capital inicial debe ser un valor positivo.")]
    public decimal? CapitalInicial { get; init; }
}

public sealed class ActualizarPortfolioRequest
{
    [StringLength(100, MinimumLength = 1)]
    public string? Nombre { get; init; }

    public string? Descripcion { get; init; }

    [Range(1, 32767)]
    public int? IdPerfilRiesgo { get; init; }

    [Range(1, 32767)]
    public int? IdMonedaBase { get; init; }

    [Range(0.000001, double.MaxValue)]
    public decimal? CapitalInicial { get; init; }

    [RegularExpression("^(ACTIVO|ARCHIVADO)$", ErrorMessage = "Estado debe ser 'ACTIVO' o 'ARCHIVADO'.")]
    public string? Estado { get; init; }
}

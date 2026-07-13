using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Portfolio;

// ── ACCIONES ──────────────────────────────────────────────────────────────────

public sealed class AgregarAccionRequest
{
    [Range(1, long.MaxValue, ErrorMessage = "IdAccion debe ser un valor válido.")]
    public long IdAccion { get; init; }

    [Range(0.000001, double.MaxValue, ErrorMessage = "La cantidad debe ser un valor positivo.")]
    public decimal Cantidad { get; init; }

    [Range(0, double.MaxValue, ErrorMessage = "El precio de compra no puede ser negativo.")]
    public decimal PrecioCompra { get; init; }
}

public sealed class ActualizarAccionRequest
{
    [Range(0.000001, double.MaxValue)]
    public decimal? Cantidad { get; init; }

    [Range(0, double.MaxValue)]
    public decimal? PrecioCompra { get; init; }
}

// ── BONOS ─────────────────────────────────────────────────────────────────────

public sealed class AgregarBonoRequest
{
    [Range(1, long.MaxValue, ErrorMessage = "IdBono debe ser un valor válido.")]
    public long IdBono { get; init; }

    [Range(0.000001, double.MaxValue, ErrorMessage = "La cantidad debe ser un valor positivo.")]
    public decimal Cantidad { get; init; }

    [Range(0, double.MaxValue, ErrorMessage = "El precio de compra no puede ser negativo.")]
    public decimal PrecioCompra { get; init; }
}

public sealed class ActualizarBonoRequest
{
    [Range(0.000001, double.MaxValue)]
    public decimal? Cantidad { get; init; }

    [Range(0, double.MaxValue)]
    public decimal? PrecioCompra { get; init; }
}

// ── LETRAS ────────────────────────────────────────────────────────────────────

public sealed class AgregarLetraRequest
{
    [Range(1, long.MaxValue, ErrorMessage = "IdLetra debe ser un valor válido.")]
    public long IdLetra { get; init; }

    [Range(0.000001, double.MaxValue, ErrorMessage = "La cantidad debe ser un valor positivo.")]
    public decimal Cantidad { get; init; }

    [Range(0, double.MaxValue, ErrorMessage = "El precio de compra no puede ser negativo.")]
    public decimal PrecioCompra { get; init; }
}

public sealed class ActualizarLetraRequest
{
    [Range(0.000001, double.MaxValue)]
    public decimal? Cantidad { get; init; }

    [Range(0, double.MaxValue)]
    public decimal? PrecioCompra { get; init; }
}

// ── PLAZOS FIJOS ──────────────────────────────────────────────────────────────

public sealed class AgregarPlazoFijoRequest
{
    [Range(1, 32767, ErrorMessage = "IdTipoPlazoFijo debe ser un valor válido.")]
    public int IdTipoPlazoFijo { get; init; }

    [Range(1, 32767, ErrorMessage = "IdMoneda debe ser un valor válido.")]
    public int IdMoneda { get; init; }

    [Required, StringLength(150, MinimumLength = 1)]
    public string EntidadFinanciera { get; init; } = "";

    [Range(0.000001, double.MaxValue, ErrorMessage = "El monto invertido debe ser un valor positivo.")]
    public decimal MontoInvertido { get; init; }

    [Range(0, double.MaxValue, ErrorMessage = "La TNA no puede ser negativa.")]
    public decimal TnaPactada { get; init; }

    [Required]
    public DateOnly? FechaInicio { get; init; }

    [Range(1, 32767, ErrorMessage = "La duración debe ser al menos 1 día.")]
    public int DuracionDias { get; init; }

    public bool ReinvertirAlVencimiento { get; init; }
}

public sealed class ActualizarPlazoFijoRequest
{
    [Range(1, 32767)]
    public int? IdTipoPlazoFijo { get; init; }

    [Range(1, 32767)]
    public int? IdMoneda { get; init; }

    [StringLength(150, MinimumLength = 1)]
    public string? EntidadFinanciera { get; init; }

    [Range(0.000001, double.MaxValue)]
    public decimal? MontoInvertido { get; init; }

    [Range(0, double.MaxValue)]
    public decimal? TnaPactada { get; init; }

    public DateOnly? FechaInicio { get; init; }

    [Range(1, 32767)]
    public int? DuracionDias { get; init; }

    public bool? ReinvertirAlVencimiento { get; init; }
}

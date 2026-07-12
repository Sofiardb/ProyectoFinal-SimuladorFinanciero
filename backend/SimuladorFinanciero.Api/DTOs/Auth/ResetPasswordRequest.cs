using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Auth;

public class ResetPasswordRequest
{
    [Required(ErrorMessage = "El token es obligatorio.")]
    public string Token { get; set; } = "";

    [Required(ErrorMessage = "La nueva contraseña es obligatoria.")]
    [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
    public string NewPassword { get; set; } = "";
}

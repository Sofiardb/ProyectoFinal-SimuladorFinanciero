using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Auth;

public class ForgotPasswordRequest
{
    [Required(ErrorMessage = "El email es obligatorio.")]
    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    public string Email { get; set; } = "";
}

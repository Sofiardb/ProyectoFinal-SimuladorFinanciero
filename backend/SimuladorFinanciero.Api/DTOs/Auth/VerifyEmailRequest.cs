using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Auth;

public class VerifyEmailRequest
{
    [Required(ErrorMessage = "El token es obligatorio.")]
    public string Token { get; set; } = "";
}

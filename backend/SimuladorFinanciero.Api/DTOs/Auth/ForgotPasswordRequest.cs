using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Auth;

public class ForgotPasswordRequest
{
    [Required(ErrorMessage = "Ingresá tu email o usuario.")]
    public string Identificador { get; set; } = "";
}

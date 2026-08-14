using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Admin;

public sealed class HacerAdminRequest
{
    [Required, StringLength(150, MinimumLength = 1)]
    public string UsernameOEmail { get; init; } = "";
}

public sealed record UsuarioAdminResponse(long IdUsuario, string Username, string Email, bool EsAdmin);

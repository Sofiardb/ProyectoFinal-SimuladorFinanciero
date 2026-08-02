using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Auth;
using SimuladorFinanciero.Api.Services;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("auth")]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    private long GetUserId() =>
        long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? throw new InvalidOperationException("Token inválido: no contiene el claim sub."));

    /// <summary>Registra un nuevo usuario y envía un email para verificar la cuenta.</summary>
    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        await _auth.RegistrarAsync(request);
        return StatusCode(StatusCodes.Status201Created, new
        {
            message = "Registro exitoso. Revisá tu email para verificar tu cuenta antes de iniciar sesión."
        });
    }

    /// <summary>Valida credenciales y devuelve un token JWT. Falla con 403 si el email todavía no fue verificado.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var response = await _auth.LoginAsync(request);
        if (response is null)
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title  = "No autorizado",
                Detail = "Credenciales incorrectas."
            });

        return Ok(response);
    }

    /// <summary>Confirma la cuenta a partir del token enviado por email.</summary>
    [HttpPost("verify-email")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request)
    {
        await _auth.VerificarEmailAsync(request);
        return Ok(new { message = "Tu email fue verificado correctamente. Ya podés iniciar sesión." });
    }

    /// <summary>Reenvía el email de verificación de cuenta, si corresponde.</summary>
    [HttpPost("resend-verification")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendVerification(ResendVerificationRequest request)
    {
        await _auth.ReenviarVerificacionAsync(request);
        return Ok(new { message = "Si la cuenta existe y todavía no fue verificada, te reenviamos el enlace." });
    }

    /// <summary>Envía un email con un enlace para restablecer la contraseña, si el email existe.</summary>
    [HttpPost("forgot-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        await _auth.SolicitarResetPasswordAsync(request);
        return Ok(new { message = "Si el email existe, vas a recibir un enlace para restablecer tu contraseña." });
    }

    /// <summary>Establece una nueva contraseña a partir de un token de recuperación válido.</summary>
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        await _auth.ResetearPasswordAsync(request);
        return Ok(new { message = "Contraseña actualizada correctamente." });
    }

    /// <summary>Actualiza los datos del usuario autenticado (no incluye contraseña ni rol).</summary>
    [HttpPut("me")]
    [Authorize]
    [ProducesResponseType(typeof(PerfilResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateMe(ActualizarPerfilRequest request) =>
        Ok(await _auth.ActualizarPerfilAsync(GetUserId(), request));
}

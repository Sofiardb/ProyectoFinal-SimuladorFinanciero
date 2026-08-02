using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SimuladorFinanciero.Api.DTOs.Auth;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services;

public interface IAuthService
{
    Task RegistrarAsync(RegisterRequest request);
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task SolicitarResetPasswordAsync(ForgotPasswordRequest request);
    Task ResetearPasswordAsync(ResetPasswordRequest request);
    Task<PerfilResponse> ActualizarPerfilAsync(long idUsuario, ActualizarPerfilRequest request);
    Task VerificarEmailAsync(VerifyEmailRequest request);
    Task ReenviarVerificacionAsync(ResendVerificationRequest request);
}

public class AuthService : IAuthService
{
    private readonly IUsuarioRepository _usuarios;
    private readonly IRegistroPendienteRepository _pendientes;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public AuthService(
        IUsuarioRepository usuarios,
        IRegistroPendienteRepository pendientes,
        IEmailService email,
        IConfiguration config)
    {
        _usuarios   = usuarios;
        _pendientes = pendientes;
        _email      = email;
        _config     = config;
    }

    /// <summary>
    /// No crea el usuario todavía: guarda un registro pendiente y manda el email de verificación.
    /// La cuenta en "usuario" recién se crea cuando confirma el enlace (ver VerificarEmailAsync).
    /// </summary>
    public async Task RegistrarAsync(RegisterRequest request)
    {
        var email    = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim();

        if (await _usuarios.BuscarPorEmailAsync(email) is not null)
            throw new ConflictException("El email ya está registrado.");

        if (await _usuarios.BuscarPorUsernameAsync(username) is not null)
            throw new ConflictException("El nombre de usuario ya está en uso.");

        var pendienteConMismoUsername = await _pendientes.BuscarPorUsernameAsync(username);
        if (pendienteConMismoUsername is not null && pendienteConMismoUsername.Email != email)
        {
            if (pendienteConMismoUsername.TokenExpira > DateTimeOffset.UtcNow)
                throw new ConflictException("El nombre de usuario ya está en uso.");

            // Nadie vino a confirmarlo y ya venció: liberamos el username.
            await _pendientes.EliminarAsync(pendienteConMismoUsername.IdRegistroPendiente);
        }

        // Un reintento con el mismo email (ej. no le llegó el mail) reemplaza el pedido anterior.
        await _pendientes.EliminarPorEmailAsync(email);

        var token     = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var pendiente = new RegistroPendiente
        {
            Email        = email,
            Username     = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Nombre       = request.Nombre,
            Apellido     = request.Apellido,
            TokenHash    = HashToken(token),
            TokenExpira  = DateTimeOffset.UtcNow.AddHours(24)
        };

        pendiente.IdRegistroPendiente = await _pendientes.CrearAsync(pendiente);

        await EnviarEmailVerificacionAsync(pendiente, token);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var id = request.Identificador.Trim();
        var usuario = id.Contains('@')
            ? await _usuarios.BuscarPorEmailAsync(id.ToLowerInvariant())
            : await _usuarios.BuscarPorUsernameAsync(id);

        if (usuario is null)
        {
            // La cuenta todavía no existe — si hay un registro pendiente, avisamos en vez
            // de devolver "credenciales incorrectas" como si nunca se hubiera registrado.
            var pendiente = id.Contains('@')
                ? await _pendientes.BuscarPorEmailAsync(id.ToLowerInvariant())
                : await _pendientes.BuscarPorUsernameAsync(id);

            if (pendiente is not null)
                throw new ForbiddenException(
                    "Todavía no verificaste tu email. Revisá tu bandeja de entrada o pedí que te reenviemos el enlace.");

            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, usuario.PasswordHash))
            return null;

        await _usuarios.ActualizarUltimoLoginAsync(usuario.IdUsuario);

        return GenerarToken(usuario);
    }

    public async Task VerificarEmailAsync(VerifyEmailRequest request)
    {
        var pendiente = await _pendientes.BuscarPorTokenHashAsync(HashToken(request.Token));
        if (pendiente is null)
            throw new ValidationException("El enlace de verificación es inválido o expiró.");

        if (await _usuarios.BuscarPorEmailAsync(pendiente.Email) is not null
            || await _usuarios.BuscarPorUsernameAsync(pendiente.Username) is not null)
        {
            await _pendientes.EliminarAsync(pendiente.IdRegistroPendiente);
            throw new ConflictException(
                "El email o nombre de usuario ya fueron tomados por otra cuenta. Registrate de nuevo.");
        }

        var usuario = new Usuario
        {
            Email        = pendiente.Email,
            Username     = pendiente.Username,
            PasswordHash = pendiente.PasswordHash,
            Nombre       = pendiente.Nombre,
            Apellido     = pendiente.Apellido
        };

        await _usuarios.CrearAsync(usuario);
        await _pendientes.EliminarAsync(pendiente.IdRegistroPendiente);
    }

    public async Task ReenviarVerificacionAsync(ResendVerificationRequest request)
    {
        var id = request.Identificador.Trim();
        var pendiente = id.Contains('@')
            ? await _pendientes.BuscarPorEmailAsync(id.ToLowerInvariant())
            : await _pendientes.BuscarPorUsernameAsync(id);

        if (pendiente is null) return; // no revelar si existe

        var token  = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expira = DateTimeOffset.UtcNow.AddHours(24);
        await _pendientes.ActualizarTokenAsync(pendiente.IdRegistroPendiente, HashToken(token), expira);

        await EnviarEmailVerificacionAsync(pendiente, token);
    }

    private async Task EnviarEmailVerificacionAsync(RegistroPendiente pendiente, string tokenCrudo)
    {
        var frontendUrl = _config["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var verifyLink  = $"{frontendUrl}/verify-email?token={tokenCrudo}";

        var cuerpo = $"""
            <p>Hola {pendiente.Nombre ?? pendiente.Username},</p>
            <p>¡Gracias por registrarte en InvestLab! Confirmá tu email para poder iniciar sesión.</p>
            <p><a href="{verifyLink}">Hacé clic acá para verificar tu cuenta</a>. Este enlace vence en 24 horas.</p>
            <p>Si no creaste esta cuenta, podés ignorar este email.</p>
            """;

        await _email.EnviarEmailAsync(pendiente.Email, "Verificá tu email — InvestLab", cuerpo);
    }

    public async Task SolicitarResetPasswordAsync(ForgotPasswordRequest request)
    {
        var usuario = await _usuarios.BuscarPorEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (usuario is null) return; // no revelar si el email existe

        var token     = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = HashToken(token);
        var expira    = DateTimeOffset.UtcNow.AddMinutes(30);

        await _usuarios.GuardarResetTokenAsync(usuario.IdUsuario, tokenHash, expira);

        var frontendUrl = _config["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetLink   = $"{frontendUrl}/reset-password?token={token}";

        var cuerpo = $"""
            <p>Hola {usuario.Nombre ?? usuario.Username},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña en InvestLab.</p>
            <p><a href="{resetLink}">Hacé clic acá para elegir una nueva contraseña</a>. Este enlace vence en 30 minutos.</p>
            <p>Si no solicitaste esto, podés ignorar este email.</p>
            """;

        await _email.EnviarEmailAsync(usuario.Email, "Restablecer tu contraseña — InvestLab", cuerpo);
    }

    public async Task ResetearPasswordAsync(ResetPasswordRequest request)
    {
        var usuario = await _usuarios.BuscarPorResetTokenHashAsync(HashToken(request.Token));
        if (usuario is null)
            throw new ValidationException("El enlace de recuperación es inválido o expiró.");

        await _usuarios.ActualizarPasswordAsync(usuario.IdUsuario, BCrypt.Net.BCrypt.HashPassword(request.NewPassword));
    }

    public async Task<PerfilResponse> ActualizarPerfilAsync(long idUsuario, ActualizarPerfilRequest request)
    {
        var usuario = await _usuarios.BuscarPorIdAsync(idUsuario)
            ?? throw new NotFoundException("Usuario no encontrado.");

        var email    = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim();

        var porEmail = await _usuarios.BuscarPorEmailAsync(email);
        if (porEmail is not null && porEmail.IdUsuario != idUsuario)
            throw new ConflictException("El email ya está registrado.");

        var porUsername = await _usuarios.BuscarPorUsernameAsync(username);
        if (porUsername is not null && porUsername.IdUsuario != idUsuario)
            throw new ConflictException("El nombre de usuario ya está en uso.");

        await _usuarios.ActualizarPerfilAsync(idUsuario, email, username, request.Nombre, request.Apellido);

        return new PerfilResponse
        {
            Email    = email,
            Username = username,
            Nombre   = request.Nombre,
            Apellido = request.Apellido,
            EsAdmin  = usuario.EsAdmin
        };
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private AuthResponse GenerarToken(Usuario usuario)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expMinutes = int.TryParse(_config["Jwt:ExpiresInMinutes"], out var m) ? m : 60;
        var expiresAt  = DateTimeOffset.UtcNow.AddMinutes(expMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   usuario.IdUsuario.ToString()),
            new(JwtRegisteredClaimNames.Email, usuario.Email ?? ""),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };

        if (usuario.EsAdmin)
            claims.Add(new Claim(ClaimTypes.Role, "Admin"));

        var token = new JwtSecurityToken(
            issuer:             _config["Jwt:Issuer"],
            audience:           _config["Jwt:Audience"],
            claims:             claims,
            expires:            expiresAt.UtcDateTime,
            signingCredentials: creds);

        return new AuthResponse
        {
            Token     = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt = expiresAt,
            Email     = usuario.Email,
            Username  = usuario.Username,
            Nombre    = usuario.Nombre,
            Apellido  = usuario.Apellido,
            EsAdmin   = usuario.EsAdmin
        };
    }
}

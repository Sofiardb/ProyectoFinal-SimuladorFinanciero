using Dapper;
using SimuladorFinanciero.Api.Infrastructure.Database;
using SimuladorFinanciero.Api.Models;

namespace SimuladorFinanciero.Api.Repositories;

public interface IUsuarioRepository
{
    Task<Usuario?> BuscarPorEmailAsync(string email);
    Task<Usuario?> BuscarPorUsernameAsync(string username);
    Task<Usuario?> BuscarPorIdAsync(long idUsuario);
    Task<Usuario?> BuscarPorResetTokenHashAsync(string tokenHash);
    Task<long> CrearAsync(Usuario usuario);
    Task ActualizarUltimoLoginAsync(long idUsuario);
    Task GuardarResetTokenAsync(long idUsuario, string tokenHash, DateTimeOffset expira);
    Task ActualizarPasswordAsync(long idUsuario, string nuevoPasswordHash);
    Task ActualizarPerfilAsync(long idUsuario, string email, string username, string? nombre, string? apellido);
    Task ActualizarEsAdminAsync(long idUsuario, bool esAdmin);
}

public class UsuarioRepository : IUsuarioRepository
{
    private readonly IDbConnectionFactory _db;

    public UsuarioRepository(IDbConnectionFactory db) => _db = db;

    public async Task<Usuario?> BuscarPorEmailAsync(string email)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE email = @email AND activo = TRUE",
            new { email });
    }

    public async Task<Usuario?> BuscarPorUsernameAsync(string username)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE username = @username AND activo = TRUE",
            new { username });
    }

    public async Task ActualizarUltimoLoginAsync(long idUsuario)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            "UPDATE usuario SET fecha_ultimo_login = NOW() WHERE id_usuario = @idUsuario",
            new { idUsuario });
    }

    public async Task<Usuario?> BuscarPorIdAsync(long idUsuario)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id_usuario = @idUsuario AND activo = TRUE",
            new { idUsuario });
    }

    public async Task ActualizarPerfilAsync(long idUsuario, string email, string username, string? nombre, string? apellido)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            """
            UPDATE usuario
            SET email = @email, username = @username, nombre = @nombre, apellido = @apellido
            WHERE id_usuario = @idUsuario
            """,
            new { idUsuario, email, username, nombre, apellido });
    }

    public async Task<Usuario?> BuscarPorResetTokenHashAsync(string tokenHash)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<Usuario>(
            """
            SELECT * FROM usuario
            WHERE reset_token_hash = @tokenHash
              AND reset_token_expira > NOW()
              AND activo = TRUE
            """,
            new { tokenHash });
    }

    public async Task GuardarResetTokenAsync(long idUsuario, string tokenHash, DateTimeOffset expira)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            """
            UPDATE usuario
            SET reset_token_hash = @tokenHash, reset_token_expira = @expira
            WHERE id_usuario = @idUsuario
            """,
            new { idUsuario, tokenHash, expira });
    }

    public async Task ActualizarPasswordAsync(long idUsuario, string nuevoPasswordHash)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            """
            UPDATE usuario
            SET password_hash = @nuevoPasswordHash, reset_token_hash = NULL, reset_token_expira = NULL
            WHERE id_usuario = @idUsuario
            """,
            new { idUsuario, nuevoPasswordHash });
    }

    public async Task ActualizarEsAdminAsync(long idUsuario, bool esAdmin)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            "UPDATE usuario SET es_admin = @esAdmin WHERE id_usuario = @idUsuario",
            new { idUsuario, esAdmin });
    }

    public async Task<long> CrearAsync(Usuario usuario)
    {
        using var conn = _db.Crear();
        const string sql = """
            INSERT INTO usuario (email, username, password_hash, nombre, apellido)
            VALUES (@Email, @Username, @PasswordHash, @Nombre, @Apellido)
            RETURNING id_usuario
            """;
        return await conn.ExecuteScalarAsync<long>(sql, usuario);
    }
}

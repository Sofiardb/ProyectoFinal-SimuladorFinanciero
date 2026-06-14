using Dapper;
using SimuladorFinanciero.Api.Infrastructure.Database;
using SimuladorFinanciero.Api.Models;

namespace SimuladorFinanciero.Api.Repositories;

public interface IUsuarioRepository
{
    Task<Usuario?> BuscarPorEmailAsync(string email);
    Task<Usuario?> BuscarPorUsernameAsync(string username);
    Task<long> CrearAsync(Usuario usuario);
    Task ActualizarUltimoLoginAsync(long idUsuario);
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

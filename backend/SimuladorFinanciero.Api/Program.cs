using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SimuladorFinanciero.Api.Infrastructure.Database;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.AlphaVantage;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.ArgentinaDatos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Bcra;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Byma;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Docta;
using SimuladorFinanciero.Api.Infrastructure.Middleware;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services;
using SimuladorFinanciero.Api.Services.BackgroundJobs;
using SimuladorFinanciero.Api.Services.Catalogo;

// snake_case PostgreSQL columns → PascalCase C# properties (e.g. id_usuario → IdUsuario)
DefaultTypeMap.MatchNamesWithUnderscores = true;
// DateOnly ↔ PostgreSQL DATE
SqlMapper.AddTypeHandler(DateOnlyTypeHandler.Instance);

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Dapper + Npgsql
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

// Auth
builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>();
builder.Services.AddScoped<IRegistroPendienteRepository, RegistroPendienteRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// Clientes de APIs externas (Singleton: mantienen cookies y tokens entre llamadas)
builder.Services.AddSingleton<IBymaApiClient, BymaApiClient>();
builder.Services.AddSingleton<IDoctaApiClient, DoctaApiClient>();
builder.Services.AddSingleton<IArgentinaDatosApiClient, ArgentinaDatosApiClient>();
builder.Services.AddSingleton<IAlphaVantageApiClient, AlphaVantageApiClient>();

// Repositorios de catálogo
builder.Services.AddSingleton<IReferenciaRepository, ReferenciaRepository>();
builder.Services.AddSingleton<ILetraRepository, LetraRepository>();
builder.Services.AddSingleton<IBonoRepository, BonoRepository>();
builder.Services.AddSingleton<IAccionRepository, AccionRepository>();

// Servicios de catálogo
builder.Services.AddSingleton<ILetraCatalogoService, LetraCatalogoService>();
builder.Services.AddSingleton<IBonoCatalogoService, BonoCatalogoService>();
builder.Services.AddSingleton<IAccionCatalogoService, AccionCatalogoService>();

// Job de refresco automático (cada 15 min en horario bursátil)
builder.Services.AddHostedService<CatalogoRefreshJob>();

// Tipo de cambio (BCRA)
builder.Services.AddScoped<IBcraApiClient, BcraApiClient>();
builder.Services.AddSingleton<ITipoCambioRepository, TipoCambioRepository>();
builder.Services.AddScoped<ITipoCambioService, TipoCambioService>();

// Portfolio CRUD
builder.Services.AddScoped<IPortfolioRepository, PortfolioRepository>();
builder.Services.AddScoped<IPortfolioService, PortfolioService>();

// Simulaciones
builder.Services.AddScoped<ISimulacionRepository, SimulacionRepository>();
builder.Services.AddScoped<ISimulacionService, SimulacionService>();
builder.Services.AddScoped<IMotorClientService, MotorClientService>();

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Simulador Financiero API",
        Version = "v1",
        Description = "Backend del simulador de estrategias de inversión — FACET UNT"
    });

    // Permite enviar el token JWT desde Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Ingresá el token JWT (sin el prefijo 'Bearer ')"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key no está configurada en appsettings.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew                = TimeSpan.Zero,
            RoleClaimType            = ClaimTypes.Role
        };
    });

builder.Services.AddAuthorization();

// CORS — en desarrollo acepta el origen del frontend React (Vite corre en 5173 por defecto)
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var origenesPermitidos = builder.Configuration
            .GetSection("Cors:OrigenesPermitidos")
            .Get<string[]>() ?? [];

        policy.WithOrigins(origenesPermitidos)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// HttpClient para llamar al motor Python
builder.Services.AddHttpClient("MotorSimulacion", client =>
{
    var url = builder.Configuration["MotorSimulacion:BaseUrl"]
        ?? throw new InvalidOperationException("MotorSimulacion:BaseUrl no está configurada.");
    client.BaseAddress = new Uri(url);
    client.Timeout = TimeSpan.FromSeconds(60);
});

// HttpClient para la API de Estadísticas Cambiarias del BCRA
builder.Services.AddHttpClient("Bcra", client =>
{
    var url = builder.Configuration["Bcra:BaseUrl"]
        ?? throw new InvalidOperationException("Bcra:BaseUrl no está configurada.");
    client.BaseAddress = new Uri(url);
    client.Timeout = TimeSpan.FromSeconds(10);
});

var app = builder.Build();

// Swagger siempre activo (proyecto académico)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Simulador Financiero API v1");
    c.RoutePrefix = string.Empty; // Swagger en la raíz: http://localhost:5000/
});

app.UseExceptionHandler();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

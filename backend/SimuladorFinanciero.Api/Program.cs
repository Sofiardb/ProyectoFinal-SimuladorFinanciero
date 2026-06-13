using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SimuladorFinanciero.Api.Infrastructure.Database;

var builder = WebApplication.CreateBuilder(args);

// Dapper + Npgsql
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

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
            ClockSkew                = TimeSpan.Zero
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

var app = builder.Build();

// Swagger siempre activo (proyecto académico)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Simulador Financiero API v1");
    c.RoutePrefix = string.Empty; // Swagger en la raíz: http://localhost:5000/
});

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

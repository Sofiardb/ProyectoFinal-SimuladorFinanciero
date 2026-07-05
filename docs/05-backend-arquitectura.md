# Backend API — Arquitectura y decisiones técnicas

**Proyecto:** `backend/SimuladorFinanciero.Api/`  
**Solución:** `backend/SimuladorFinanciero.sln`  
**Framework:** C# / .NET 8 / ASP.NET Core

---

## 1. Stack tecnológico

| Paquete NuGet | Versión | Rol |
|---|---|---|
| `Dapper` | 2.1.35 | Micro-ORM: ejecuta SQL y mapea resultados a clases C# |
| `Npgsql` | 8.0.7 | Driver PostgreSQL para .NET |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 8.0.17 | Validación de tokens JWT en cada request |
| `Swashbuckle.AspNetCore` | 6.9.0 | Swagger UI (OpenAPI 3) |
| `BCrypt.Net-Next` | 4.0.3 | Hash de contraseñas en registro/login |

---

## 2. Decisión: Dapper en lugar de Entity Framework Core

Se evaluaron dos opciones para acceso a datos:

**Entity Framework Core (descartado)**  
EF Core ofrece migrations automáticas que mantienen el schema en sincronía con las clases de dominio. Sin embargo, ese mecanismo asume que el schema *deriva* del código C#. En este proyecto el esquema se diseñó en SQL (`db/01_schema.sql`) con tipos, restricciones e índices pensados específicamente para PostgreSQL: columnas `NUMERIC(10,8)` para tasas, `JSONB` para arrays de estadísticas, restricciones parciales en índices. EF Core no puede expresar esas decisiones de la misma forma, y mantener migraciones paralelas al SQL sería redundante y fuente de divergencias.

**Dapper (elegido)**  
Dapper es un micro-ORM: ejecuta el SQL que el desarrollador escribe y mapea el resultado a clases C#. No genera queries ni modifica el schema. El SQL de `db/01_schema.sql` es la única fuente de verdad; Dapper lo complementa sin reemplazarlo. El overhead es mínimo y el comportamiento es totalmente predecible.

---

## 3. Estructura de carpetas

```
backend/SimuladorFinanciero.Api/
├── Controllers/
│   ├── AuthController.cs           POST /auth/register, POST /auth/login
│   ├── HealthController.cs         GET /health
│   ├── ReferenciaController.cs     GET /referencia/*
│   ├── InstrumentoController.cs    GET /instrumentos/*
│   ├── AdminController.cs          /admin/catalogo/* (rol Admin)
│   ├── PortfolioController.cs      CRUD portfolios + tenencias
│   └── SimulacionController.cs     Simulación y resultados
├── DTOs/
│   ├── Auth/
│   │   ├── RegisterRequest.cs
│   │   ├── LoginRequest.cs
│   │   └── AuthResponse.cs
│   ├── Instrumentos/
│   │   ├── LetraResponse.cs
│   │   ├── BonoResponse.cs
│   │   ├── AccionResponse.cs
│   │   ├── TipoPlazoFijoResponse.cs
│   │   └── GbmRefreshResult.cs
│   ├── Referencia/
│   │   ├── MonedaResponse.cs
│   │   ├── PerfilRiesgoResponse.cs
│   │   ├── TipoEscenarioResponse.cs
│   │   └── EscenarioEconomicoResponse.cs
│   ├── Portfolio/
│   │   ├── PortfolioResumenResponse.cs
│   │   ├── PortfolioDetalleResponse.cs
│   │   ├── CrearPortfolioRequest.cs
│   │   ├── ActualizarPortfolioRequest.cs
│   │   └── (requests/responses de tenencias: acciones, bonos, letras, plazos fijos)
│   └── Simulacion/
│       ├── SimularRequest.cs
│       ├── SimulacionResumenResponse.cs
│       ├── SimulacionDetalleResponse.cs
│       ├── ResultadoSimulacionResponse.cs
│       └── SimulacionPreviewResponse.cs
├── Infrastructure/
│   ├── Database/
│   │   ├── DbConnectionFactory.cs
│   │   └── DateOnlyTypeHandler.cs
│   ├── ExternalApis/
│   │   ├── AlphaVantage/           AlphaVantageApiClient.cs
│   │   ├── Byma/                   BymaApiClient.cs
│   │   └── Docta/                  DoctaApiClient.cs
│   ├── Exceptions/
│   │   └── AppException.cs
│   ├── Middleware/
│   │   └── GlobalExceptionHandler.cs
│   └── Swagger/
│       └── SecurityResponsesFilter.cs
├── Models/
│   ├── Usuario.cs
│   ├── Accion.cs
│   ├── Bono.cs
│   ├── FlujoBono.cs
│   ├── Letra.cs
│   ├── Portfolio.cs
│   ├── PortfolioAccion.cs
│   ├── PortfolioBono.cs
│   ├── PortfolioLetra.cs
│   ├── PortfolioPlazoFijo.cs
│   ├── Simulacion.cs
│   ├── SimulacionParametroEscenario.cs
│   └── ResultadoSimulacion.cs
├── Repositories/
│   ├── UsuarioRepository.cs
│   ├── ReferenciaRepository.cs
│   ├── LetraRepository.cs
│   ├── BonoRepository.cs
│   ├── AccionRepository.cs
│   ├── PortfolioRepository.cs
│   └── SimulacionRepository.cs
├── Services/
│   ├── AuthService.cs
│   ├── PortfolioService.cs
│   ├── SimulacionService.cs        (incluye MotorPayloadBuilder como clase interna)
│   ├── MotorClientService.cs
│   ├── BackgroundJobs/
│   │   └── CatalogoRefreshJob.cs
│   └── Catalogo/
│       ├── LetraCatalogoService.cs
│       ├── BonoCatalogoService.cs
│       ├── AccionCatalogoService.cs
│       └── GbmMath.cs
├── Program.cs
├── appsettings.json
└── appsettings.Development.json
```

---

## 4. Registro de dependencias — lifetimes

La elección de `Scoped` vs `Singleton` sigue un criterio claro: cualquier clase que mantiene **estado entre requests** (sesión HTTP, token OAuth2) es Singleton; todo lo que depende del contexto de un request específico es Scoped.

| Clase | Lifetime | Motivo |
|---|---|---|
| `DbConnectionFactory` | Singleton | Gestiona el connection string; sin estado de conexión propio. Dapper abre y cierra una `IDbConnection` por query |
| `ReferenciaRepository`, `LetraRepository`, `BonoRepository`, `AccionRepository` | Singleton | Los catálogos se actualizan una vez por día; la instancia puede reutilizarse entre requests |
| `BymaApiClient` | Singleton | Mantiene la cookie de sesión HTTP establecida en el primer GET a BYMA |
| `DoctaApiClient` | Singleton | Mantiene el token OAuth2 y lo renueva cuando expira |
| `AlphaVantageApiClient` | Singleton | Cachea la serie de SPX en memoria (TTL 24 horas) |
| `LetraCatalogoService`, `BonoCatalogoService`, `AccionCatalogoService` | Singleton | Solo usan repositorios y clientes Singleton |
| `CatalogoRefreshJob` | Hosted Service | Administrado por el runtime de .NET; se registra con `AddHostedService` |
| `PortfolioRepository`, `PortfolioService` | Scoped | Operan sobre datos del usuario autenticado; instancia nueva por request |
| `SimulacionRepository`, `SimulacionService`, `MotorClientService` | Scoped | La transacción de persistencia debe vivir dentro del mismo request |
| `UsuarioRepository`, `AuthService` | Scoped | Sin estado compartido entre requests |

---

## 5. Convenciones de Dapper

### Mapeo snake_case → PascalCase

PostgreSQL usa `snake_case` para las columnas (`id_usuario`, `fecha_vencimiento`). C# usa PascalCase (`IdUsuario`, `FechaVencimiento`). La siguiente línea en `Program.cs` habilita la conversión automática globalmente:

```csharp
DefaultTypeMap.MatchNamesWithUnderscores = true;
```

Sin esto, Dapper no encontraría la correspondencia y devolvería los campos en `null`.

### DateOnly ↔ DATE de PostgreSQL

`DateOnly` (disponible en .NET 6+) no tiene un handler por defecto en Dapper para Npgsql. `DateOnlyTypeHandler` resuelve la conversión en ambas direcciones:

```csharp
SqlMapper.AddTypeHandler(DateOnlyTypeHandler.Instance);
```

### SMALLSERIAL y el cast a `::int`

Las tablas con `SMALLSERIAL` devuelven `Int16`. Dapper no puede mapear `Int16` a un campo `int` en un record de C#. La solución es castear en el SQL antes de que Dapper lo lea:

```sql
SELECT id_perfil_riesgo::int, nombre, sigma_max_accion FROM perfil_riesgo
```

---

## 6. Manejo de errores — GlobalExceptionHandler

Implementa `IExceptionHandler` de .NET 8. Se registra con `AddExceptionHandler<GlobalExceptionHandler>()` y `UseExceptionHandler()` en el pipeline. Intercepta cualquier excepción no manejada antes de que llegue al cliente y devuelve **Problem Details** (RFC 7807).

### Jerarquía de excepciones de dominio

```
AppException (base)
├── NotFoundException       → HTTP 404  "No encontrado"
├── ConflictException       → HTTP 409  "Conflicto"
├── ValidationException     → HTTP 422  "Error de validación"
└── ExternalApiException    → HTTP 502  "Servicio externo no disponible"
```

Las excepciones se lanzan desde la capa de servicios. El handler las convierte en:

```json
{
  "status": 409,
  "title": "Conflicto",
  "detail": "Ya existe un portfolio con el nombre 'Mi portfolio' para el perfil de riesgo seleccionado."
}
```

Excepciones no tipadas (errores inesperados) → `500 Internal Server Error`, logueadas con `LogError`.

### SecurityResponsesFilter

`IOperationFilter` de Swashbuckle que agrega automáticamente las respuestas de error en la documentación Swagger, basándose en los atributos de cada endpoint:

- `401 Unauthorized` → todos los endpoints con `[Authorize]`
- `403 Forbidden` → endpoints con `[Authorize(Roles = "...")]`
- `500 Internal Server Error` → todos los endpoints

---

## 7. Autenticación JWT

### Flujo

1. El cliente llama a `POST /auth/login` con email y contraseña.
2. `AuthService` verifica el hash BCrypt contra la DB.
3. Si es válido, genera un JWT firmado con `Jwt:Key` (User Secret local).
4. El cliente envía el token en el header `Authorization: Bearer <token>` en cada request siguiente.
5. ASP.NET Core valida el token automáticamente antes de ejecutar cada controlador con `[Authorize]`.

### Parámetros de validación

```json
// appsettings.json (valores reales en User Secrets)
"Jwt": {
  "Key":      "<mínimo 32 caracteres — en User Secrets>",
  "Issuer":   "SimuladorFinanciero",
  "Audience": "SimuladorFinanciero"
}
```

`ClockSkew = TimeSpan.Zero`: sin tolerancia de desfase horario entre servidor y cliente. El token expira exactamente al tiempo configurado.

### Roles

La columna `es_admin BOOLEAN NOT NULL DEFAULT FALSE` en `usuario` determina el rol del usuario.

Al generar el JWT, `AuthService` incluye `ClaimTypes.Role = "Admin"` si `es_admin = true`. Los controladores usan `[Authorize(Roles = "Admin")]` para restringir el acceso.

| Controlador / endpoint | Requerimiento de acceso |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Público (sin auth) |
| `GET /health` | Público |
| `GET /referencia/*` | Cualquier usuario autenticado |
| `GET /instrumentos/*` | Cualquier usuario autenticado |
| `GET /portfolios`, `POST /portfolios`, etc. | Cualquier usuario autenticado |
| `GET /simulaciones/*`, `POST /portfolios/{id}/simular` | Cualquier usuario autenticado |
| `GET /admin/catalogo/*`, `POST /admin/catalogo/*` | Rol `Admin` |

El primer admin se crea manualmente por SQL:

```sql
UPDATE simulador_financiero.usuario SET es_admin = TRUE WHERE username = 'nombre_del_admin';
```

`AuthResponse` incluye el campo `EsAdmin: bool` para que el frontend pueda mostrar u ocultar las funciones de administración sin necesidad de una llamada adicional.

---

## 8. Swagger

Siempre activo (proyecto académico). Disponible en la raíz: `http://localhost:5000/`.

Configurado con `AddSecurityDefinition("Bearer")`: el Swagger UI incluye un botón "Authorize" donde se ingresa el token JWT para probar endpoints protegidos directamente desde el navegador.

---

## 9. CORS

La política `"Frontend"` acepta requests únicamente de los orígenes configurados:

```json
// appsettings.json
"Cors": {
  "OrigenesPermitidos": ["http://localhost:5173"]
}
```

Permite `AllowAnyHeader` y `AllowAnyMethod` para los orígenes configurados. Vite (el bundler del frontend React) corre en el puerto `5173` por defecto.

---

## 10. Cliente HTTP del motor Python

```json
// appsettings.json
"MotorSimulacion": {
  "BaseUrl": "http://localhost:5050"
}
```

Registrado con `AddHttpClient("MotorSimulacion")`. `MotorClientService` recibe la instancia via `IHttpClientFactory`, que gestiona el ciclo de vida del `HttpClient` de forma correcta (evita el problema de socket exhaustion que ocurre al instanciar `HttpClient` directamente).

Timeout: **60 segundos**. Una simulación con un portfolio grande puede tardar hasta ~400ms en el motor; 60 segundos provee margen holgado para latencia de red y picos de carga.

Si el motor devuelve un status no exitoso, `MotorClientService` lanza `ExternalApiException` → `GlobalExceptionHandler` lo convierte en `502 Bad Gateway`.

---

## 11. Validación de input

Los DTOs de request usan Data Annotations de ASP.NET Core:

- `[Required]` — campo obligatorio
- `[EmailAddress]` — formato de email
- `[MinLength(n)]` — longitud mínima de string
- `[Range(min, max)]` — rango numérico

El atributo `[ApiController]` en cada controlador activa la validación automática: si el request no pasa las annotations, devuelve `400 Bad Request` con los errores de validación antes de que el método del controlador llegue a ejecutarse.

Las reglas de negocio que no pueden expresarse con annotations (unicidad en DB, restricciones por perfil de riesgo, estado del portfolio) se validan en la capa de servicios y lanzan excepciones tipadas (`ConflictException`, `ValidationException`).

---

## 12. Configuración y secretos

### appsettings.json

Contiene placeholders o valores por defecto que no son sensibles:

```json
{
  "ConnectionStrings": { "Postgres": "" },
  "Jwt": { "Key": "", "Issuer": "SimuladorFinanciero", "Audience": "SimuladorFinanciero" },
  "MotorSimulacion": { "BaseUrl": "http://localhost:5050" },
  "Cors": { "OrigenesPermitidos": ["http://localhost:5173"] },
  "CatalogoRefresh": { "HoraEjecucionArt": "11:30" },
  "AlphaVantage": { "ApiKey": "" },
  "Docta": { "ClientId": "", "ClientSecret": "" }
}
```

### appsettings.Development.json

```json
{
  "CatalogoRefresh": { "Habilitado": false }
}
```

`Habilitado: false` desactiva el job de refresco automático en desarrollo para no consumir la cuota diaria de las APIs externas. Los endpoints manuales de administración (`POST /admin/catalogo/refresh/*`) siguen funcionando.

### User Secrets

Las credenciales reales nunca se commitean al repositorio. Se configuran con `dotnet user-secrets`:

```powershell
cd backend/SimuladorFinanciero.Api

dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=simulador_financiero;Username=postgres;Password=TU_PASSWORD;Search Path=simulador_financiero"
dotnet user-secrets set "Jwt:Key" "una-clave-secreta-de-al-menos-32-caracteres"
dotnet user-secrets set "AlphaVantage:ApiKey" "TU_API_KEY"
dotnet user-secrets set "Docta:ClientId" "TU_CLIENT_ID"
dotnet user-secrets set "Docta:ClientSecret" "TU_CLIENT_SECRET"
```

Los User Secrets se almacenan en `%APPDATA%\Microsoft\UserSecrets\` y son locales al equipo de desarrollo.

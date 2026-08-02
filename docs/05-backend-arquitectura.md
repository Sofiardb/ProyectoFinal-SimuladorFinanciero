# Backend API — Arquitectura

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

El acceso a datos se resuelve con Dapper en lugar de Entity Framework Core. EF Core ofrece migrations automáticas que mantienen el schema en sincronía con las clases de dominio, pero ese mecanismo asume que el schema deriva del código C#; en este proyecto el esquema se diseñó directamente en SQL (`db/01_schema.sql`), con tipos, restricciones e índices pensados específicamente para PostgreSQL — columnas `NUMERIC(10,8)` para tasas, `JSONB` para arrays de estadísticas, restricciones parciales en índices —, decisiones que EF Core no puede expresar de la misma forma, y mantener migraciones paralelas al SQL sería redundante y fuente de divergencias. Dapper, en cambio, es un micro-ORM que ejecuta el SQL que el desarrollador escribe y mapea el resultado a clases C#, sin generar queries ni modificar el schema: el SQL de `db/01_schema.sql` queda como única fuente de verdad, Dapper lo complementa sin reemplazarlo, y su overhead es mínimo con comportamiento totalmente predecible.

## 2. Estructura de carpetas

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

La solución sigue una arquitectura en capas: `Controllers` resuelve presentación (HTTP, autenticación, serialización), `Services` concentra la lógica de negocio, y `Repositories` aísla el acceso a datos vía Dapper. Los `DTOs` mantienen el contrato de la API desacoplado de los `Models` (entidades de dominio), y `Infrastructure` agrupa las piezas transversales — conexión a base de datos, clientes de APIs externas, manejo de excepciones, filtros de Swagger.

## 3. Ciclo de vida de las dependencias

El registro de dependencias en `Program.cs` sigue un criterio simple: cualquier clase que mantiene estado entre requests (sesión HTTP, token OAuth2) se registra como `Singleton`, y todo lo que depende del contexto de un request específico se registra como `Scoped`.

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

## 4. Convenciones de Dapper

PostgreSQL usa `snake_case` para las columnas (`id_usuario`, `fecha_vencimiento`), mientras que C# usa PascalCase (`IdUsuario`, `FechaVencimiento`); `DefaultTypeMap.MatchNamesWithUnderscores = true` en `Program.cs` habilita la conversión automática de forma global, sin la cual Dapper no encontraría la correspondencia y devolvería los campos en `null`.

`DateOnly` (disponible desde .NET 6) no tiene un handler por defecto en Dapper para Npgsql; `DateOnlyTypeHandler`, registrado con `SqlMapper.AddTypeHandler(DateOnlyTypeHandler.Instance)`, resuelve la conversión hacia y desde `DATE` de PostgreSQL en ambas direcciones.

Las tablas con `SMALLSERIAL` devuelven `Int16`, que Dapper no puede mapear directamente a un campo `int` en un record de C#. La solución es castear en el propio SQL antes de que Dapper lo lea: `SELECT id_perfil_riesgo::int, nombre, sigma_max_accion FROM perfil_riesgo`.

## 5. Manejo de errores

`GlobalExceptionHandler` implementa `IExceptionHandler` de .NET 8, se registra con `AddExceptionHandler<GlobalExceptionHandler>()` y `UseExceptionHandler()` en el pipeline, e intercepta cualquier excepción no manejada antes de que llegue al cliente, devolviendo Problem Details (RFC 7807). Las excepciones de dominio forman una jerarquía simple, lanzada desde la capa de servicios:

```
AppException (base)
├── NotFoundException       → HTTP 404  "No encontrado"
├── ConflictException       → HTTP 409  "Conflicto"
├── ValidationException     → HTTP 422  "Error de validación"
└── ExternalApiException    → HTTP 502  "Servicio externo no disponible"
```

El handler las convierte en una respuesta uniforme, por ejemplo:

```json
{
  "status": 409,
  "title": "Conflicto",
  "detail": "Ya existe un portfolio con el nombre 'Mi portfolio' para el perfil de riesgo seleccionado."
}
```

Las excepciones no tipadas (errores inesperados) resultan en `500 Internal Server Error`, logueadas con `LogError`. `SecurityResponsesFilter`, un `IOperationFilter` de Swashbuckle, agrega automáticamente las respuestas de error correspondientes en la documentación Swagger según los atributos de cada endpoint: `401 Unauthorized` en todos los endpoints con `[Authorize]`, `403 Forbidden` en los que además tienen `[Authorize(Roles = "...")]`, y `500 Internal Server Error` en todos.

Por la misma razón de no filtrar información interna, `GET /health` — público y sin autenticación, porque el hosting lo usa como chequeo de salud del servicio — nunca incluye el detalle de una excepción en su respuesta: si la base de datos no responde, el `Exception` completo (que puede incluir el connection string) se loguea del lado del servidor con `LogError`, y el cliente solo recibe `{ "estado": "ok", "db": "error" }` con status `503`.

## 6. Autenticación y autorización

El flujo de autenticación es el estándar de JWT bearer: el cliente llama a `POST /auth/login` con email y contraseña, `AuthService` verifica el hash BCrypt contra la base de datos y, si es válido, genera un JWT firmado con `Jwt:Key` (User Secret local); el cliente envía ese token en el header `Authorization: Bearer <token>` en cada request siguiente, y ASP.NET Core lo valida automáticamente antes de ejecutar cualquier controlador marcado con `[Authorize]`. Los parámetros de validación se configuran en `appsettings.json`, con los valores reales en User Secrets:

```json
"Jwt": {
  "Key":      "<mínimo 32 caracteres — en User Secrets>",
  "Issuer":   "SimuladorFinanciero",
  "Audience": "SimuladorFinanciero"
}
```

`ClockSkew = TimeSpan.Zero` elimina la tolerancia de desfase horario entre servidor y cliente, de modo que el token expira exactamente al tiempo configurado.

La columna `es_admin BOOLEAN NOT NULL DEFAULT FALSE` en `usuario` determina el rol: al generar el JWT, `AuthService` incluye `ClaimTypes.Role = "Admin"` si `es_admin = true`, y los controladores usan `[Authorize(Roles = "Admin")]` para restringir el acceso a las operaciones administrativas.

| Controlador / endpoint | Requerimiento de acceso |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Público (sin auth) |
| `GET /health` | Público |
| `GET /referencia/*` | Cualquier usuario autenticado |
| `GET /instrumentos/*` | Cualquier usuario autenticado |
| `GET /portfolios`, `POST /portfolios`, etc. | Cualquier usuario autenticado |
| `GET /simulaciones/*`, `POST /portfolios/{id}/simular` | Cualquier usuario autenticado |
| `GET /admin/catalogo/*`, `POST /admin/catalogo/*` | Rol `Admin` |

El primer administrador se crea manualmente por SQL (`UPDATE simulador_financiero.usuario SET es_admin = TRUE WHERE username = 'nombre_del_admin'`), y `AuthResponse` incluye el campo `EsAdmin: bool` para que el frontend pueda mostrar u ocultar las funciones de administración sin necesidad de una llamada adicional.

## 7. Swagger

Swagger está siempre activo, incluso pensado como proyecto académico, disponible en la raíz tanto en desarrollo (`http://localhost:5000/`) como en producción (`https://proyectofinal-simuladorfinanciero-1.onrender.com/`), y configurado con `AddSecurityDefinition("Bearer")`: la UI incluye un botón "Authorize" donde se ingresa el token JWT para probar endpoints protegidos directamente desde el navegador, sin necesidad de un cliente HTTP externo.

## 8. CORS

La política `"Frontend"` acepta requests únicamente de los orígenes configurados en `appsettings.json`:

```json
"Cors": {
  "OrigenesPermitidos": ["http://localhost:5173"]
}
```

y permite `AllowAnyHeader` y `AllowAnyMethod` para esos orígenes. En desarrollo, el único origen permitido es `http://localhost:5173` — donde corre Vite, el bundler del frontend React, por defecto —; en producción, este mismo array se sobrescribe por variable de entorno (sección 11) para apuntar a `https://proyectofinal-investlab.vercel.app`, el dominio donde queda publicado el frontend.

## 9. Cliente HTTP del motor Python

La URL del motor se configura en `appsettings.json` (`"MotorSimulacion": { "BaseUrl": "http://localhost:5050" }` en desarrollo; `https://proyectofinal-simuladorfinanciero.onrender.com` en producción, vía variable de entorno) y se registra con `AddHttpClient("MotorSimulacion")`; `MotorClientService` recibe la instancia vía `IHttpClientFactory`, que gestiona correctamente el ciclo de vida del `HttpClient` y evita el problema de agotamiento de sockets que ocurre al instanciarlo directamente. El timeout es de 60 segundos: una simulación con un portfolio grande puede tardar hasta ~400ms en el motor, así que ese margen es holgado frente a latencia de red y picos de carga. Si el motor devuelve un status no exitoso, `MotorClientService` lanza `ExternalApiException`, que `GlobalExceptionHandler` convierte en `502 Bad Gateway`.

## 10. Validación de input

Los DTOs de request usan Data Annotations de ASP.NET Core — `[Required]` para campos obligatorios, `[EmailAddress]` para formato de email, `[MinLength(n)]` para longitud mínima de string, `[Range(min, max)]` para rangos numéricos —, y el atributo `[ApiController]` en cada controlador activa la validación automática: si el request no pasa las annotations, devuelve `400 Bad Request` con el detalle antes de que el método del controlador llegue a ejecutarse. Las reglas de negocio que no pueden expresarse con annotations — unicidad en base de datos, restricciones por perfil de riesgo, estado del portfolio — se validan en la capa de servicios y lanzan las excepciones tipadas de la sección 5 (`ConflictException`, `ValidationException`).

## 11. Configuración: desarrollo local frente al hosting

`appsettings.json` contiene placeholders o valores por defecto que no son sensibles, con los valores de desarrollo local:

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

En producción, las variables de entorno equivalentes (sección siguiente) sobrescriben `MotorSimulacion:BaseUrl` con `https://proyectofinal-simuladorfinanciero.onrender.com` y `Cors:OrigenesPermitidos` con `https://proyectofinal-investlab.vercel.app`.

`appsettings.Development.json` agrega `"CatalogoRefresh": { "Habilitado": false }`, que desactiva el job de refresco automático en desarrollo para no consumir la cuota diaria de las APIs externas; los endpoints manuales de administración (`POST /admin/catalogo/refresh/*`) siguen funcionando igual. En desarrollo, las credenciales reales (connection string, `Jwt:Key`, API keys) nunca se commitean al repositorio: se configuran con `dotnet user-secrets`, que las almacena en `%APPDATA%\Microsoft\UserSecrets\`, locales al equipo de desarrollo:

```powershell
cd backend/SimuladorFinanciero.Api

dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=simulador_financiero;Username=postgres;Password=TU_PASSWORD;Search Path=simulador_financiero"
dotnet user-secrets set "Jwt:Key" "una-clave-secreta-de-al-menos-32-caracteres"
dotnet user-secrets set "AlphaVantage:ApiKey" "TU_API_KEY"
dotnet user-secrets set "Docta:ClientId" "TU_CLIENT_ID"
dotnet user-secrets set "Docta:ClientSecret" "TU_CLIENT_SECRET"
```

No existe un `appsettings.Production.json`: en el hosting, esas mismas claves se configuran como variables de entorno en el panel del proveedor, usando la convención de doble guión bajo que el proveedor de configuración de ASP.NET Core interpreta como jerarquía (`ConnectionStrings__Postgres`, `Jwt__Key`, `Cors__OrigenesPermitidos__0`, `AlphaVantage__ApiKey`, `Docta__ClientId`, `Docta__ClientSecret`), sin necesidad de ningún archivo adicional ni de tocar el código: el mismo `IConfiguration` que lee `appsettings.json` en desarrollo lee esas variables en producción, con prioridad más alta, así que el valor de entorno siempre gana. `Cors:OrigenesPermitidos` es la única clave que cambia de intención entre ambos entornos, no solo de valor: en desarrollo apunta a `localhost:5173`, y en producción se sobrescribe con `https://proyectofinal-investlab.vercel.app`, el dominio real donde queda publicado el frontend.

El backend se empaqueta en un contenedor Docker (`backend/SimuladorFinanciero.Api/Dockerfile`), que compila y publica la API en modo Release, fija `ASPNETCORE_ENVIRONMENT=Production`, y arranca Kestrel escuchando en el puerto que el hosting le asigne en runtime a través de la variable `PORT` (`ASPNETCORE_URLS=http://+:${PORT:-8080}`), en vez de un puerto fijo — la misma convención de puerto dinámico que el motor Python adopta en `run.py` (`app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5050)))`), típica de plataformas de hosting gratuito tipo PaaS. El frontend, por su parte, se publica como sitio estático; como React Router maneja el ruteo del lado del cliente, `frontend/vercel.json` agrega una regla de rewrite (`/(.*) → /index.html`) para que cualquier ruta profunda (por ejemplo, recargar la página en `/portfolios/3`) siga sirviendo el `index.html` de la aplicación en vez de devolver `404`, ya que el servidor estático no tiene un archivo real en esa ruta.

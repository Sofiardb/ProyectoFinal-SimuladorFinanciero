namespace SimuladorFinanciero.Api.Infrastructure.Exceptions;

/// <summary>Excepción base para errores de dominio controlados.</summary>
public abstract class AppException(string message) : Exception(message);

public sealed class NotFoundException(string message)     : AppException(message);
public sealed class ConflictException(string message)     : AppException(message);
public sealed class ExternalApiException(string message)  : AppException(message);
public sealed class ValidationException(string message)   : AppException(message);
public sealed class ForbiddenException(string message)    : AppException(message);

using SimuladorFinanciero.Api.DTOs.Portfolio;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;
using SimuladorFinanciero.Api.Services.Catalogo;

namespace SimuladorFinanciero.Api.Services;

public interface IPortfolioService
{
    Task<IReadOnlyList<PortfolioResumenResponse>> ObtenerPorUsuarioAsync(long idUsuario, CancellationToken ct = default);
    Task<PortfolioDetalleResponse> ObtenerDetalleAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);
    Task<PortfolioResumenResponse> CrearAsync(long idUsuario, CrearPortfolioRequest req, CancellationToken ct = default);
    Task<PortfolioResumenResponse> ActualizarAsync(long idPortfolio, long idUsuario, ActualizarPortfolioRequest req, CancellationToken ct = default);
    Task EliminarAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);

    Task<PortfolioAccionResponse> AgregarAccionAsync(long idPortfolio, long idUsuario, AgregarAccionRequest req, CancellationToken ct = default);
    Task<PortfolioAccionResponse> ActualizarAccionAsync(long idPortfolio, long idUsuario, long idAccion, ActualizarAccionRequest req, CancellationToken ct = default);
    Task EliminarAccionAsync(long idPortfolio, long idUsuario, long idAccion, CancellationToken ct = default);

    Task<PortfolioBonoResponse> AgregarBonoAsync(long idPortfolio, long idUsuario, AgregarBonoRequest req, CancellationToken ct = default);
    Task<PortfolioBonoResponse> ActualizarBonoAsync(long idPortfolio, long idUsuario, long idBono, ActualizarBonoRequest req, CancellationToken ct = default);
    Task EliminarBonoAsync(long idPortfolio, long idUsuario, long idBono, CancellationToken ct = default);

    Task<PortfolioLetraResponse> AgregarLetraAsync(long idPortfolio, long idUsuario, AgregarLetraRequest req, CancellationToken ct = default);
    Task<PortfolioLetraResponse> ActualizarLetraAsync(long idPortfolio, long idUsuario, long idLetra, ActualizarLetraRequest req, CancellationToken ct = default);
    Task EliminarLetraAsync(long idPortfolio, long idUsuario, long idLetra, CancellationToken ct = default);

    Task<PortfolioPlazoFijoResponse> AgregarPlazoFijoAsync(long idPortfolio, long idUsuario, AgregarPlazoFijoRequest req, CancellationToken ct = default);
    Task<PortfolioPlazoFijoResponse> ActualizarPlazoFijoAsync(long idPortfolio, long idUsuario, long idPortfolioPlazoFijo, ActualizarPlazoFijoRequest req, CancellationToken ct = default);
    Task EliminarPlazoFijoAsync(long idPortfolio, long idUsuario, long idPortfolioPlazoFijo, CancellationToken ct = default);
}

public sealed class PortfolioService : IPortfolioService
{
    private readonly IPortfolioRepository _repo;
    private readonly ITipoCambioService _tipoCambio;

    public PortfolioService(IPortfolioRepository repo, ITipoCambioService tipoCambio)
    {
        _repo = repo;
        _tipoCambio = tipoCambio;
    }

    // ── Portfolio CRUD ────────────────────────────────────────────────────────

    public Task<IReadOnlyList<PortfolioResumenResponse>> ObtenerPorUsuarioAsync(long idUsuario, CancellationToken ct = default)
        => _repo.ObtenerPorUsuarioAsync(idUsuario, ct);

    public async Task<PortfolioDetalleResponse> ObtenerDetalleAsync(long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        var detalle = await _repo.ObtenerDetalleAsync(idPortfolio, idUsuario, ct);
        return detalle ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");
    }

    public async Task<PortfolioResumenResponse> CrearAsync(long idUsuario, CrearPortfolioRequest req, CancellationToken ct = default)
    {
        if (!await _repo.ExistePerfilRiesgoAsync(req.IdPerfilRiesgo, ct))
            throw new NotFoundException($"Perfil de riesgo {req.IdPerfilRiesgo} no existe.");

        if (!await _repo.ExisteMonedaAsync(req.IdMonedaBase, ct))
            throw new NotFoundException($"Moneda {req.IdMonedaBase} no existe.");

        if (await _repo.ExisteNombreAsync(idUsuario, req.Nombre, req.IdPerfilRiesgo, ct))
            throw new ConflictException($"Ya existe un portfolio con el nombre '{req.Nombre}' para el perfil de riesgo seleccionado.");

        return await _repo.CrearAsync(idUsuario, req, ct);
    }

    public async Task<PortfolioResumenResponse> ActualizarAsync(long idPortfolio, long idUsuario, ActualizarPortfolioRequest req, CancellationToken ct = default)
    {
        var actual = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        // Validar nuevo perfil de riesgo si cambia (antes de la validación de nombre)
        if (req.IdPerfilRiesgo.HasValue)
        {
            if (!await _repo.ExistePerfilRiesgoAsync(req.IdPerfilRiesgo.Value, ct))
                throw new NotFoundException($"Perfil de riesgo {req.IdPerfilRiesgo.Value} no existe.");
        }

        // Nombre único dentro del mismo usuario + perfil de riesgo.
        // El check aplica cuando cambia el nombre O cuando cambia el perfil (la combinación resultante podría colisionar).
        var efectivoPerfil = req.IdPerfilRiesgo ?? actual.IdPerfilRiesgo;
        var efectivoNombre = req.Nombre ?? actual.Nombre;
        bool nombreCambia  = req.Nombre is not null && req.Nombre != actual.Nombre;
        bool perfilCambia  = req.IdPerfilRiesgo.HasValue && req.IdPerfilRiesgo.Value != actual.IdPerfilRiesgo;

        if (nombreCambia || perfilCambia)
        {
            if (await _repo.ExisteNombreParaOtroAsync(idUsuario, efectivoNombre, efectivoPerfil, idPortfolio, ct))
                throw new ConflictException($"Ya existe un portfolio con el nombre '{efectivoNombre}' para el perfil de riesgo seleccionado.");
        }

        // Validar compatibilidad de acciones con el nuevo perfil si es más restrictivo
        if (perfilCambia)
        {
            if (!await _repo.AccionesCompatiblesConPerfilAsync(idPortfolio, req.IdPerfilRiesgo!.Value, ct))
                throw new ValidationException(
                    "El nuevo perfil de riesgo es más restrictivo que las acciones actuales del portfolio. " +
                    "Elimine o reemplace las acciones con volatilidad elevada antes de cambiar el perfil.");
        }

        if (req.IdMonedaBase.HasValue && !await _repo.ExisteMonedaAsync(req.IdMonedaBase.Value, ct))
            throw new NotFoundException($"Moneda {req.IdMonedaBase.Value} no existe.");

        // Merge de valores: se aplican solo los campos proporcionados
        var nombre         = req.Nombre         ?? actual.Nombre;
        var descripcion    = req.Descripcion    ?? actual.Descripcion;
        var idPerfilRiesgo = req.IdPerfilRiesgo ?? actual.IdPerfilRiesgo;
        var idMonedaBase   = req.IdMonedaBase   ?? actual.IdMonedaBase;
        var capitalInicial = req.CapitalInicial ?? actual.CapitalInicial;   // decimal?
        var horizonteMeses = req.HorizonteMeses ?? actual.HorizonteMeses;
        var estado         = req.Estado         ?? actual.Estado;

        // Si se establece o cambia el presupuesto, verificar que no quede por debajo del total ya invertido
        if (req.CapitalInicial.HasValue)
        {
            var (totalUsd, totalArs) = await _repo.ObtenerTotalInvertidoPorMonedaAsync(idPortfolio, ct);
            // Solo hay que resolver el nuevo código de moneda si la moneda base cambió; si no, ya lo tenemos en `actual`.
            var codigoMonedaBase = req.IdMonedaBase.HasValue
                ? await _repo.ObtenerCodigoMonedaAsync(idMonedaBase, ct)
                : actual.CodigoMonedaBase;
            var totalActual = await ConvertirAMonedaBaseAsync(totalArs, totalUsd, codigoMonedaBase!, ct);
            if (totalActual > req.CapitalInicial.Value)
                throw new ValidationException(
                    $"El presupuesto ({req.CapitalInicial.Value:N2} {codigoMonedaBase}) es menor que el total actualmente invertido " +
                    $"({totalActual:N2} {codigoMonedaBase}). Ajuste las tenencias antes de modificar el presupuesto.");
        }

        var updated = await _repo.ActualizarAsync(
            idPortfolio, idUsuario, nombre, descripcion,
            idPerfilRiesgo, idMonedaBase, capitalInicial, horizonteMeses, estado, ct);

        return updated ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");
    }

    public async Task EliminarAsync(long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        if (!await _repo.EliminarAsync(idPortfolio, idUsuario, ct))
            throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");
    }

    // ── Acciones ──────────────────────────────────────────────────────────────

    public async Task<PortfolioAccionResponse> AgregarAccionAsync(long idPortfolio, long idUsuario, AgregarAccionRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        var infoAccion = await _repo.ObtenerInfoAccionAsync(req.IdAccion, ct);
        if (infoAccion is null)
            throw new NotFoundException($"Acción {req.IdAccion} no existe.");
        if (!infoAccion.Value.Activa)
            throw new ValidationException($"La acción {req.IdAccion} no está activa en el catálogo.");

        // Validar restricción de sigma según perfil de riesgo
        if (infoAccion.Value.Sigma.HasValue)
        {
            var sigmaMax = await _repo.ObtenerSigmaMaxAsync(portfolio.IdPerfilRiesgo, ct);
            if (infoAccion.Value.Sigma.Value > sigmaMax)
                throw new ValidationException(
                    $"La volatilidad de la acción (σ = {infoAccion.Value.Sigma.Value:P2}) supera el máximo " +
                    $"permitido por el perfil de riesgo del portfolio (σ_max = {sigmaMax:P2}).");
        }

        if (await _repo.ExisteAccionEnPortfolioAsync(idPortfolio, req.IdAccion, ct))
            throw new ConflictException($"La acción {req.IdAccion} ya existe en el portfolio. Use PUT para actualizar la posición.");

        await ValidarPresupuestoAsync(portfolio, req.Cantidad * req.PrecioCompra, "USD", ct);

        return await _repo.AgregarAccionAsync(idPortfolio, req.IdAccion, req.Cantidad, req.PrecioCompra, ct);
    }

    public async Task<PortfolioAccionResponse> ActualizarAccionAsync(long idPortfolio, long idUsuario, long idAccion, ActualizarAccionRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        var actual = await _repo.ObtenerAccionTenenciaAsync(idPortfolio, idAccion, ct)
            ?? throw new NotFoundException($"La acción {idAccion} no está en el portfolio {idPortfolio}.");

        var cantidad     = req.Cantidad     ?? actual.Cantidad;
        var precioCompra = req.PrecioCompra ?? actual.PrecioCompra;

        await ValidarPresupuestoAsync(portfolio, cantidad * precioCompra, "USD", ct,
            montoRemplazo: actual.Cantidad * actual.PrecioCompra);

        var updated = await _repo.ActualizarAccionAsync(idPortfolio, idAccion, cantidad, precioCompra, ct)
            ?? throw new NotFoundException($"La acción {idAccion} no está en el portfolio {idPortfolio}.");

        return updated;
    }

    public async Task EliminarAccionAsync(long idPortfolio, long idUsuario, long idAccion, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.EliminarAccionAsync(idPortfolio, idAccion, ct))
            throw new NotFoundException($"La acción {idAccion} no está en el portfolio {idPortfolio}.");
    }

    // ── Bonos ─────────────────────────────────────────────────────────────────

    public async Task<PortfolioBonoResponse> AgregarBonoAsync(long idPortfolio, long idUsuario, AgregarBonoRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.ExisteBonoActivoAsync(req.IdBono, ct))
            throw new NotFoundException($"Bono {req.IdBono} no existe o no está activo.");

        if (await _repo.ExisteBonoEnPortfolioAsync(idPortfolio, req.IdBono, ct))
            throw new ConflictException($"El bono {req.IdBono} ya existe en el portfolio. Use PUT para actualizar la posición.");

        await ValidarPresupuestoAsync(portfolio, req.Cantidad * req.PrecioCompra, "ARS", ct);

        return await _repo.AgregarBonoAsync(idPortfolio, req.IdBono, req.Cantidad, req.PrecioCompra, ct);
    }

    public async Task<PortfolioBonoResponse> ActualizarBonoAsync(long idPortfolio, long idUsuario, long idBono, ActualizarBonoRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        var actual = await _repo.ObtenerBonoTenenciaAsync(idPortfolio, idBono, ct)
            ?? throw new NotFoundException($"El bono {idBono} no está en el portfolio {idPortfolio}.");

        var cantidad     = req.Cantidad     ?? actual.Cantidad;
        var precioCompra = req.PrecioCompra ?? actual.PrecioCompra;

        await ValidarPresupuestoAsync(portfolio, cantidad * precioCompra, "ARS", ct,
            montoRemplazo: actual.Cantidad * actual.PrecioCompra);

        var updated = await _repo.ActualizarBonoAsync(idPortfolio, idBono, cantidad, precioCompra, ct)
            ?? throw new NotFoundException($"El bono {idBono} no está en el portfolio {idPortfolio}.");

        return updated;
    }

    public async Task EliminarBonoAsync(long idPortfolio, long idUsuario, long idBono, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.EliminarBonoAsync(idPortfolio, idBono, ct))
            throw new NotFoundException($"El bono {idBono} no está en el portfolio {idPortfolio}.");
    }

    // ── Letras ────────────────────────────────────────────────────────────────

    public async Task<PortfolioLetraResponse> AgregarLetraAsync(long idPortfolio, long idUsuario, AgregarLetraRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.ExisteLetraActivaAsync(req.IdLetra, ct))
            throw new NotFoundException($"Letra {req.IdLetra} no existe o no está activa.");

        if (await _repo.ExisteLetraEnPortfolioAsync(idPortfolio, req.IdLetra, ct))
            throw new ConflictException($"La letra {req.IdLetra} ya existe en el portfolio. Use PUT para actualizar la posición.");

        await ValidarPresupuestoAsync(portfolio, req.Cantidad * req.PrecioCompra, "ARS", ct);

        return await _repo.AgregarLetraAsync(idPortfolio, req.IdLetra, req.Cantidad, req.PrecioCompra, ct);
    }

    public async Task<PortfolioLetraResponse> ActualizarLetraAsync(long idPortfolio, long idUsuario, long idLetra, ActualizarLetraRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        var actual = await _repo.ObtenerLetraTenenciaAsync(idPortfolio, idLetra, ct)
            ?? throw new NotFoundException($"La letra {idLetra} no está en el portfolio {idPortfolio}.");

        var cantidad     = req.Cantidad     ?? actual.Cantidad;
        var precioCompra = req.PrecioCompra ?? actual.PrecioCompra;

        await ValidarPresupuestoAsync(portfolio, cantidad * precioCompra, "ARS", ct,
            montoRemplazo: actual.Cantidad * actual.PrecioCompra);

        var updated = await _repo.ActualizarLetraAsync(idPortfolio, idLetra, cantidad, precioCompra, ct)
            ?? throw new NotFoundException($"La letra {idLetra} no está en el portfolio {idPortfolio}.");

        return updated;
    }

    public async Task EliminarLetraAsync(long idPortfolio, long idUsuario, long idLetra, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.EliminarLetraAsync(idPortfolio, idLetra, ct))
            throw new NotFoundException($"La letra {idLetra} no está en el portfolio {idPortfolio}.");
    }

    // ── Plazos Fijos ──────────────────────────────────────────────────────────

    public async Task<PortfolioPlazoFijoResponse> AgregarPlazoFijoAsync(long idPortfolio, long idUsuario, AgregarPlazoFijoRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.ExisteTipoPlazoFijoAsync(req.IdTipoPlazoFijo, ct))
            throw new NotFoundException($"Tipo de plazo fijo {req.IdTipoPlazoFijo} no existe.");

        if (!await _repo.ExisteMonedaAsync(req.IdMoneda, ct))
            throw new NotFoundException($"Moneda {req.IdMoneda} no existe.");

        ValidarFechaInicio(req.FechaInicio!.Value);

        var codigoMoneda = await _repo.ObtenerCodigoMonedaAsync(req.IdMoneda, ct);
        await ValidarPresupuestoAsync(portfolio, req.MontoInvertido, codigoMoneda!, ct);

        return await _repo.AgregarPlazoFijoAsync(idPortfolio, req, ct);
    }

    public async Task<PortfolioPlazoFijoResponse> ActualizarPlazoFijoAsync(long idPortfolio, long idUsuario, long idPortfolioPlazoFijo, ActualizarPlazoFijoRequest req, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        var actual = await _repo.ObtenerPlazoFijoTenenciaAsync(idPortfolioPlazoFijo, idPortfolio, ct)
            ?? throw new NotFoundException($"Plazo fijo {idPortfolioPlazoFijo} no está en el portfolio {idPortfolio}.");

        if (req.IdTipoPlazoFijo.HasValue && !await _repo.ExisteTipoPlazoFijoAsync(req.IdTipoPlazoFijo.Value, ct))
            throw new NotFoundException($"Tipo de plazo fijo {req.IdTipoPlazoFijo.Value} no existe.");

        if (req.IdMoneda.HasValue && !await _repo.ExisteMonedaAsync(req.IdMoneda.Value, ct))
            throw new NotFoundException($"Moneda {req.IdMoneda.Value} no existe.");

        if (req.FechaInicio.HasValue)
            ValidarFechaInicio(req.FechaInicio.Value);

        var data = new ActualizarPlazoFijoData
        {
            IdTipoPlazoFijo         = req.IdTipoPlazoFijo         ?? actual.IdTipoPlazoFijo,
            IdMoneda                = req.IdMoneda                ?? actual.IdMoneda,
            EntidadFinanciera       = req.EntidadFinanciera       ?? actual.EntidadFinanciera,
            MontoInvertido          = req.MontoInvertido          ?? actual.MontoInvertido,
            TnaPactada              = req.TnaPactada              ?? actual.TnaPactada,
            FechaInicio             = req.FechaInicio             ?? actual.FechaInicio,
            DuracionDias           = req.DuracionDias           ?? actual.DuracionDias,
            ReinvertirAlVencimiento = req.ReinvertirAlVencimiento ?? actual.ReinvertirAlVencimiento,
        };

        var codigoMonedaNuevaTask  = _repo.ObtenerCodigoMonedaAsync(data.IdMoneda, ct);
        var codigoMonedaActualTask = _repo.ObtenerCodigoMonedaAsync(actual.IdMoneda, ct);
        await Task.WhenAll(codigoMonedaNuevaTask, codigoMonedaActualTask);

        await ValidarPresupuestoAsync(portfolio, data.MontoInvertido, codigoMonedaNuevaTask.Result!, ct,
            montoRemplazo: actual.MontoInvertido, codigoMonedaRemplazo: codigoMonedaActualTask.Result);

        var updated = await _repo.ActualizarPlazoFijoAsync(idPortfolioPlazoFijo, idPortfolio, data, ct)
            ?? throw new NotFoundException($"Plazo fijo {idPortfolioPlazoFijo} no está en el portfolio {idPortfolio}.");

        return updated;
    }

    public async Task EliminarPlazoFijoAsync(long idPortfolio, long idUsuario, long idPortfolioPlazoFijo, CancellationToken ct = default)
    {
        var portfolio = await _repo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        ValidarEstadoActivo(portfolio.Estado);

        if (!await _repo.EliminarPlazoFijoAsync(idPortfolioPlazoFijo, idPortfolio, ct))
            throw new NotFoundException($"Plazo fijo {idPortfolioPlazoFijo} no está en el portfolio {idPortfolio}.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void ValidarEstadoActivo(string estado)
    {
        if (estado != "ACTIVO")
            throw new ValidationException("No se puede modificar un portfolio archivado. Reactívelo primero cambiando su estado a ACTIVO.");
    }

    private static void ValidarFechaInicio(DateOnly fechaInicio)
    {
        if (fechaInicio < DateOnly.FromDateTime(DateTime.UtcNow))
            throw new ValidationException("La fecha de inicio no puede ser anterior a hoy.");
    }

    private async Task ValidarPresupuestoAsync(
        Portfolio portfolio, decimal montoNuevo, string codigoMonedaNuevo, CancellationToken ct,
        decimal montoRemplazo = 0m, string? codigoMonedaRemplazo = null)
    {
        if (!portfolio.CapitalInicial.HasValue) return;
        codigoMonedaRemplazo ??= codigoMonedaNuevo;

        var (totalUsd, totalArs) = await _repo.ObtenerTotalInvertidoPorMonedaAsync(portfolio.IdPortfolio, ct);
        if (codigoMonedaRemplazo == "USD") totalUsd -= montoRemplazo; else totalArs -= montoRemplazo;
        if (codigoMonedaNuevo   == "USD") totalUsd += montoNuevo;   else totalArs += montoNuevo;

        var totalEnBase = await ConvertirAMonedaBaseAsync(totalArs, totalUsd, portfolio.CodigoMonedaBase, ct);

        if (totalEnBase > portfolio.CapitalInicial.Value)
        {
            var exceso = totalEnBase - portfolio.CapitalInicial.Value;
            throw new ValidationException(
                $"Esta tenencia supera el presupuesto del portfolio: **{totalEnBase:N2} {portfolio.CodigoMonedaBase}** de " +
                $"**{portfolio.CapitalInicial.Value:N2} {portfolio.CodigoMonedaBase}** (excede por **{exceso:N2} {portfolio.CodigoMonedaBase}**).\n" +
                "Podés aumentar el presupuesto del portfolio, reducir la cantidad, o elegir otro instrumento.");
        }
    }

    private async Task<decimal> ConvertirAMonedaBaseAsync(decimal totalArs, decimal totalUsd, string codigoMonedaBase, CancellationToken ct)
    {
        switch (codigoMonedaBase)
        {
            case "ARS":
                return totalUsd == 0m ? totalArs : totalArs + totalUsd * await _tipoCambio.ObtenerCotizacionUsdArsAsync(ct);
            case "USD":
                return totalArs == 0m ? totalUsd : totalUsd + totalArs / await _tipoCambio.ObtenerCotizacionUsdArsAsync(ct);
            default:
                throw new ValidationException(
                    $"No se puede calcular el presupuesto: la moneda '{codigoMonedaBase}' no está soportada para conversión (solo ARS/USD).");
        }
    }
}

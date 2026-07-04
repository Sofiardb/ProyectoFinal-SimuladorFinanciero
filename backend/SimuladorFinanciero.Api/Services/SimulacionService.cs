using System.Text.Json;
using SimuladorFinanciero.Api.DTOs.Simulacion;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services;

public interface ISimulacionService
{
    Task<SimulacionResumenResponse> SimularAsync(
        long idPortfolio, long idUsuario, SimularRequest req, CancellationToken ct = default);
}

public sealed class SimulacionService : ISimulacionService
{
    private readonly IPortfolioRepository  _portfolioRepo;
    private readonly ISimulacionRepository _simRepo;
    private readonly IMotorClientService   _motor;

    public SimulacionService(
        IPortfolioRepository  portfolioRepo,
        ISimulacionRepository simRepo,
        IMotorClientService   motor)
    {
        _portfolioRepo = portfolioRepo;
        _simRepo       = simRepo;
        _motor         = motor;
    }

    public async Task<SimulacionResumenResponse> SimularAsync(
        long idPortfolio, long idUsuario, SimularRequest req, CancellationToken ct = default)
    {
        // 1. Load portfolio header
        var portfolio = await _portfolioRepo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        // 2. Load tenencias + escenarios in parallel
        var tenenciasTask  = _simRepo.ObtenerTenenciasParaSimulacionAsync(idPortfolio, ct);
        var escenariosTask = _simRepo.ObtenerEscenariosVigentesAsync(ct);
        await Task.WhenAll(tenenciasTask, escenariosTask);

        var tenencias  = tenenciasTask.Result;
        var escenarios = escenariosTask.Result;

        // 3. Validations
        var totalInstrumentos = tenencias.Acciones.Count + tenencias.Bonos.Count
                              + tenencias.Letras.Count   + tenencias.PlazosFijos.Count;
        if (totalInstrumentos == 0)
            throw new ValidationException("El portfolio no tiene instrumentos para simular.");

        var accionesSinGbm = tenencias.Acciones
            .Where(a => a.Mu is null || a.Sigma is null || a.Rho is null)
            .Select(a => a.Ticker)
            .ToList();
        if (accionesSinGbm.Count > 0)
            throw new ValidationException(
                $"Las siguientes acciones no tienen parámetros GBM estimados: {string.Join(", ", accionesSinGbm)}. " +
                "Ejecute el refresh del catálogo desde el panel de administración.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var instrumentosVencidos = new List<string>();
        foreach (var l in tenencias.Letras)
            if (l.FechaVencimiento <= today)
                instrumentosVencidos.Add($"letra_{l.IdLetra}");
        foreach (var b in tenencias.Bonos)
            if (b.Flujos.All(f => f.FechaPago <= today))
                instrumentosVencidos.Add($"bono_{b.IdBono}");
        foreach (var pf in tenencias.PlazosFijos)
        {
            var fv = pf.FechaInicio.AddMonths(pf.DuracionMeses);
            if (fv <= today && !pf.ReinvertirAlVencimiento)
                instrumentosVencidos.Add($"plazo_fijo_{pf.IdPortfolioPlazoFijo}");
        }
        if (instrumentosVencidos.Count > 0)
            throw new ValidationException(
                $"Los siguientes instrumentos están vencidos y bloquean la simulación: " +
                $"[{string.Join(", ", instrumentosVencidos)}]. Elimínelos o reemplácelos.");

        if (escenarios.Length < 3)
            throw new ValidationException("No hay escenarios económicos vigentes configurados.");

        var tMeses = req.HorizonteMeses ?? portfolio.HorizonteMeses;

        // 4. Validate bono flujos vs horizon
        foreach (var b in tenencias.Bonos)
        {
            var flujosFuturos = b.Flujos.Where(f => f.FechaPago > today).ToList();
            if (flujosFuturos.Count == 0) continue;
            var maxMes = flujosFuturos.Max(f => MesesEntre(today, f.FechaPago));
            if (maxMes > tMeses)
                throw new ValidationException(
                    $"El horizonte ({tMeses} meses) no cubre todos los flujos del bono {b.Ticker} " +
                    $"(vence en {maxMes} meses). Amplíe el horizonte o elimine el bono.");
        }

        // 5. Build motor payload
        var semilla   = req.Semilla ?? new Random().NextInt64(1, long.MaxValue);
        var snapshots = new List<InstrumentoSimulacionSnapshot>();
        var payload   = MotorPayloadBuilder.Build(tenencias, escenarios, tMeses, semilla, today, snapshots);

        // 6. Call motor
        var motorResponse = await _motor.SimularAsync(payload, ct);

        // 7. Extract aggregate metrics
        var valorInicial = snapshots.Sum(s => s.Monto);
        var (valorEsperado, valorMinimo, valorMaximo) = ExtraerAgregados(motorResponse);
        decimal? retornoEsperadoPct = valorInicial != 0
            ? (valorEsperado - valorInicial) / valorInicial
            : null;
        decimal? rendimientoRealPct = valorInicial != 0
            ? ExtraerGananciasReales(motorResponse) / valorInicial
            : null;

        var semillaUsada = motorResponse.TryGetProperty("semilla", out var semEl)
            ? semEl.GetInt64()
            : semilla;

        // 8. Persist (transaction)
        var insertData = new InsertSimulacionData(
            IdPortfolio:        idPortfolio,
            HorizonteMeses:     tMeses,
            NumTrayectorias:    1000,
            SeedAleatoria:      semillaUsada,
            ValorInicial:       valorInicial,
            ValorEsperado:      valorEsperado,
            ValorMinimo:        valorMinimo,
            ValorMaximo:        valorMaximo,
            RetornoEsperadoPct: retornoEsperadoPct,
            RendimientoRealPct: rendimientoRealPct,
            DesvioEstandar:     null
        );

        long idSimulacion = 0;
        await _simRepo.ExecuteInTransaccionAsync(async (conn, tx, innerCt) =>
        {
            idSimulacion = await _simRepo.InsertSimulacionAsync(insertData, conn, tx, innerCt);
            await _simRepo.InsertParametrosEscenarioAsync(idSimulacion, escenarios, conn, tx, innerCt);
            await _simRepo.InsertSimulacionInstrumentosAsync(idSimulacion, snapshots, conn, tx, innerCt);
            await _simRepo.InsertResultadosAsync(idSimulacion, tMeses, motorResponse, conn, tx, innerCt);
        }, ct);

        return new SimulacionResumenResponse(
            IdSimulacion:       idSimulacion,
            IdPortfolio:        idPortfolio,
            FechaEjecucion:     DateTimeOffset.UtcNow,
            HorizonteMeses:     tMeses,
            NumTrayectorias:    1000,
            SeedAleatoria:      semillaUsada,
            ValorInicial:       valorInicial,
            ValorEsperado:      valorEsperado,
            ValorMinimo:        valorMinimo,
            ValorMaximo:        valorMaximo,
            RetornoEsperadoPct: retornoEsperadoPct,
            RendimientoRealPct: rendimientoRealPct,
            DesvioEstandar:     null,
            Observaciones:      null);
    }

    private static (decimal? esperado, decimal? minimo, decimal? maximo) ExtraerAgregados(JsonElement r)
    {
        decimal arsEsp = 0, arsMin = 0, arsMax = 0;
        decimal usdEsp = 0, usdMin = 0, usdMax = 0;

        if (r.TryGetProperty("portfolio_ars", out var ars) &&
            ars.TryGetProperty("patrimonio", out var arsP) &&
            arsP.TryGetProperty("global", out var arsG))
        {
            arsEsp = LastValue(arsG, "media");
            arsMin = LastValue(arsG, "minimo");
            arsMax = LastValue(arsG, "maximo");
        }

        if (r.TryGetProperty("portfolio_usd", out var usd) &&
            usd.TryGetProperty("patrimonio", out var usdP) &&
            usdP.TryGetProperty("global", out var usdG))
        {
            usdEsp = LastValue(usdG, "media");
            usdMin = LastValue(usdG, "minimo");
            usdMax = LastValue(usdG, "maximo");
        }

        return (arsEsp + usdEsp, arsMin + usdMin, arsMax + usdMax);
    }

    private static decimal ExtraerGananciasReales(JsonElement r)
    {
        decimal ars = 0, usd = 0;

        if (r.TryGetProperty("portfolio_ars", out var arsEl) &&
            arsEl.TryGetProperty("ganancias_reales", out var arsGr) &&
            arsGr.TryGetProperty("global", out var arsG))
            ars = LastValue(arsG, "media");

        if (r.TryGetProperty("portfolio_usd", out var usdEl) &&
            usdEl.TryGetProperty("ganancias_reales", out var usdGr) &&
            usdGr.TryGetProperty("global", out var usdG))
            usd = LastValue(usdG, "media");

        return ars + usd;
    }

    private static decimal LastValue(JsonElement statsEl, string key)
    {
        if (!statsEl.TryGetProperty(key, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return 0m;
        var last = arr.EnumerateArray().LastOrDefault();
        return last.ValueKind == JsonValueKind.Undefined ? 0m : last.GetDecimal();
    }

    private static int MesesEntre(DateOnly desde, DateOnly hasta)
        => (hasta.Year - desde.Year) * 12 + (hasta.Month - desde.Month);
}

// ── Motor payload builder ─────────────────────────────────────────────────────

internal static class MotorPayloadBuilder
{
    internal static object Build(
        TenenciasSimulacionData tenencias,
        EscenarioSimulacion[]   escenarios,
        int                     tMeses,
        long                    semilla,
        DateOnly                today,
        List<InstrumentoSimulacionSnapshot> snapshots)
    {
        var instrumentos = new List<object>();

        foreach (var a in tenencias.Acciones)
        {
            var monto  = a.Cantidad * a.PrecioCompra;
            var ambito = $"accion_{a.IdAccion}";
            var inst   = new
            {
                id    = ambito,
                tipo  = "accion",
                monto = (double)monto,
                mu    = (double)a.Mu!.Value,
                sigma = (double)a.Sigma!.Value,
                rho   = (double)a.Rho!.Value
            };
            instrumentos.Add(inst);
            snapshots.Add(new InstrumentoSimulacionSnapshot(
                ambito, "accion", a.IdAccion, null, null, null, monto,
                JsonSerializer.Serialize(inst)));
        }

        foreach (var l in tenencias.Letras)
        {
            var monto  = l.Cantidad * l.PrecioCompra;
            var ambito = $"letra_{l.IdLetra}";
            var tVenc  = MesesEntre(today, l.FechaVencimiento);
            var inst   = new
            {
                id           = ambito,
                tipo         = l.Tipo,
                monto        = (double)monto,
                tna          = (double)l.Tna,
                t_venc_meses = tVenc
            };
            instrumentos.Add(inst);
            snapshots.Add(new InstrumentoSimulacionSnapshot(
                ambito, l.Tipo, null, null, l.IdLetra, null, monto,
                JsonSerializer.Serialize(inst)));
        }

        foreach (var b in tenencias.Bonos)
        {
            var monto        = b.Cantidad * b.PrecioCompra;
            var ambito       = $"bono_{b.IdBono}";
            var flujosFuturos = b.Flujos
                .Where(f => f.FechaPago > today)
                .OrderBy(f => f.FechaPago)
                .ToList();

            object inst;
            if (b.Tipo == "bono_tasa_fija")
            {
                var flujos = flujosFuturos
                    .Select(f => new { mes = MesesEntre(today, f.FechaPago), monto = (double)(f.MontoCupon + f.MontoCapital) })
                    .ToArray();
                inst = new { id = ambito, tipo = b.Tipo, monto = (double)monto, flujos, tir = (double)b.TasaDescuento };
            }
            else
            {
                var flujos_base = flujosFuturos
                    .Select(f => new { mes = MesesEntre(today, f.FechaPago), capital_adj = (double)f.MontoCapital, interest_adj = (double)f.MontoCupon })
                    .ToArray();
                inst = new { id = ambito, tipo = b.Tipo, monto = (double)monto, flujos_base, tir_real = (double)b.TasaDescuento };
            }
            instrumentos.Add(inst);
            snapshots.Add(new InstrumentoSimulacionSnapshot(
                ambito, b.Tipo, null, b.IdBono, null, null, monto,
                JsonSerializer.Serialize(inst)));
        }

        foreach (var pf in tenencias.PlazosFijos)
        {
            var ambito  = $"plazo_fijo_{pf.IdPortfolioPlazoFijo}";
            var fv      = pf.FechaInicio.AddMonths(pf.DuracionMeses);
            var tVenc   = MesesEntre(today, fv);
            var tipo    = ResolveTipoPlazoFijo(pf);

            object inst;
            if (pf.TipoCodigo == "UVA")
            {
                inst = new
                {
                    id               = ambito,
                    tipo,
                    monto            = (double)pf.MontoInvertido,
                    tasa_real_anual  = (double)pf.TnaPactada,
                    t_venc_meses     = tVenc,
                    reinvertir       = pf.ReinvertirAlVencimiento
                };
            }
            else
            {
                inst = new
                {
                    id           = ambito,
                    tipo,
                    monto        = (double)pf.MontoInvertido,
                    tna          = (double)pf.TnaPactada,
                    t_venc_meses = tVenc,
                    reinvertir   = pf.ReinvertirAlVencimiento
                };
            }
            instrumentos.Add(inst);
            snapshots.Add(new InstrumentoSimulacionSnapshot(
                ambito, tipo, null, null, null, pf.IdPortfolioPlazoFijo, pf.MontoInvertido,
                JsonSerializer.Serialize(inst)));
        }

        var escenariosPayload = new Dictionary<string, object>();
        foreach (var e in escenarios)
        {
            escenariosPayload[e.Codigo.ToLowerInvariant()] = new
            {
                inflacion_mensual_min = (double)e.InflacionMensualMin,
                inflacion_mensual_max = (double)e.InflacionMensualMax
            };
        }

        return new
        {
            T_meses      = tMeses,
            semilla,
            escenarios   = escenariosPayload,
            instrumentos
        };
    }

    private static string ResolveTipoPlazoFijo(PlazoFijoTenenciaSimulacion pf)
        => pf.TipoCodigo switch
        {
            "UVA"        => "plazo_fijo_uva",
            "TRADICIONAL" when pf.MonedaCodigo == "USD" => "plazo_fijo_usd",
            _            => "plazo_fijo_tradicional"
        };

    private static int MesesEntre(DateOnly desde, DateOnly hasta)
        => (hasta.Year - desde.Year) * 12 + (hasta.Month - desde.Month);
}

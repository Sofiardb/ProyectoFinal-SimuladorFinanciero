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
    private const int NumTrayectoriasMotor = 3000;

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
        // 1. Cargar cabecera del portfolio
        var portfolio = await _portfolioRepo.ObtenerCabeceraAsync(idPortfolio, idUsuario, ct)
            ?? throw new NotFoundException($"Portfolio {idPortfolio} no encontrado.");

        // 2. Cargar tenencias + escenarios en paralelo
        var tenenciasTask  = _simRepo.ObtenerTenenciasParaSimulacionAsync(idPortfolio, ct);
        var escenariosTask = _simRepo.ObtenerEscenariosVigentesAsync(ct);
        await Task.WhenAll(tenenciasTask, escenariosTask);

        var tenencias  = tenenciasTask.Result;
        var escenarios = escenariosTask.Result;

        // 3. Validaciones
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
            var fv = pf.FechaInicio.AddDays(pf.DuracionDias);
            if (fv <= today && !pf.ReinvertirAlVencimiento)
                instrumentosVencidos.Add($"plazo_fijo_{pf.IdPortfolioPlazoFijo}");
        }
        if (instrumentosVencidos.Count > 0)
            throw new ValidationException(
                $"Los siguientes instrumentos están vencidos y bloquean la simulación: " +
                $"[{string.Join(", ", instrumentosVencidos)}]. Elimínelos o reemplácelos.");

        if (escenarios.Length < 3)
            throw new ValidationException("No hay escenarios económicos vigentes configurados.");

        var tMeses = req.HorizonteMeses;

        // 4. Armar payload del motor
        var semilla   = req.Semilla ?? new Random().NextInt64(1, long.MaxValue);
        var snapshots = new List<InstrumentoSimulacionSnapshot>();
        var payload   = MotorPayloadBuilder.Build(tenencias, escenarios, tMeses, semilla, today, snapshots);

        // 5. Invocar al motor
        var motorResponse = await _motor.SimularAsync(payload, ct);

        // 6. Extraer métricas agregadas
        var valorInicial = snapshots.Sum(s => s.Monto);
        var m = ExtraerMetricas(motorResponse);

        var semillaUsada = motorResponse.TryGetProperty("semilla", out var semEl)
            ? semEl.GetInt64()
            : semilla;

        // 7. Persistir (transacción)
        var insertData = new InsertSimulacionData(
            IdPortfolio:            idPortfolio,
            HorizonteMeses:         tMeses,
            NumTrayectorias:        NumTrayectoriasMotor,
            SeedAleatoria:          semillaUsada,
            ValorInicial:           valorInicial,
            ValorEsperado:          m.ValorEsperado,
            ValorMinimo:            m.ValorMinimo,
            ValorMaximo:            m.ValorMaximo,
            RetornoEsperadoPct:     m.RetornoEsperadoPct,
            RendimientoRealPct:     m.RendimientoRealPct,
            DesvioEstandar:         null,
            ValorInicialArs:        m.ValorInicialArs,
            ValorInicialUsd:        m.ValorInicialUsd,
            ValorEsperadoArs:       m.ValorEsperadoArs,
            ValorEsperadoUsd:       m.ValorEsperadoUsd,
            ValorMinimoArs:         m.ValorMinimoArs,
            ValorMinimoUsd:         m.ValorMinimoUsd,
            ValorMaximoArs:         m.ValorMaximoArs,
            ValorMaximoUsd:         m.ValorMaximoUsd,
            RetornoEsperadoPctArs:  m.RetornoEsperadoPctArs,
            RetornoEsperadoPctUsd:  m.RetornoEsperadoPctUsd,
            RendimientoRealPctArs:  m.RendimientoRealPctArs,
            RendimientoRealPctUsd:  m.RendimientoRealPctUsd
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
            IdSimulacion:           idSimulacion,
            IdPortfolio:            idPortfolio,
            FechaEjecucion:         DateTimeOffset.UtcNow,
            HorizonteMeses:         tMeses,
            NumTrayectorias:        NumTrayectoriasMotor,
            SeedAleatoria:          semillaUsada,
            ValorInicial:           valorInicial,
            ValorEsperado:          m.ValorEsperado,
            ValorMinimo:            m.ValorMinimo,
            ValorMaximo:            m.ValorMaximo,
            RetornoEsperadoPct:     m.RetornoEsperadoPct,
            RendimientoRealPct:     m.RendimientoRealPct,
            DesvioEstandar:         null,
            Observaciones:          null,
            ValorInicialArs:        m.ValorInicialArs,
            ValorInicialUsd:        m.ValorInicialUsd,
            ValorEsperadoArs:       m.ValorEsperadoArs,
            ValorEsperadoUsd:       m.ValorEsperadoUsd,
            ValorMinimoArs:         m.ValorMinimoArs,
            ValorMinimoUsd:         m.ValorMinimoUsd,
            ValorMaximoArs:         m.ValorMaximoArs,
            ValorMaximoUsd:         m.ValorMaximoUsd,
            RetornoEsperadoPctArs:  m.RetornoEsperadoPctArs,
            RetornoEsperadoPctUsd:  m.RetornoEsperadoPctUsd,
            RendimientoRealPctArs:  m.RendimientoRealPctArs,
            RendimientoRealPctUsd:  m.RendimientoRealPctUsd);
    }

    /// <summary>
    /// Ambas monedas se mantienen siempre separadas (Ars/Usd, poblados siempre). Los campos combinados
    /// (ValorEsperado, ValorMinimo, ValorMaximo, RetornoEsperadoPct, RendimientoRealPct) solo tienen valor
    /// cuando el portfolio invierte en una sola moneda — combinarlos requeriría proyectar el tipo de
    /// cambio a T meses, algo que el motor deliberadamente no hace (docs/02 Decisión 9).
    /// </summary>
    private readonly record struct MetricasAgregadas(
        decimal? ValorEsperado, decimal? ValorMinimo, decimal? ValorMaximo,
        decimal? RetornoEsperadoPct, decimal? RendimientoRealPct,
        decimal  ValorInicialArs, decimal  ValorInicialUsd,
        decimal  ValorEsperadoArs, decimal  ValorEsperadoUsd,
        decimal  ValorMinimoArs, decimal  ValorMinimoUsd,
        decimal  ValorMaximoArs, decimal  ValorMaximoUsd,
        decimal? RetornoEsperadoPctArs, decimal? RetornoEsperadoPctUsd,
        decimal? RendimientoRealPctArs, decimal? RendimientoRealPctUsd);

    private static MetricasAgregadas ExtraerMetricas(JsonElement r)
    {
        decimal arsIni = 0, arsEsp = 0, arsMin = 0, arsMax = 0, arsGr = 0;
        decimal usdIni = 0, usdEsp = 0, usdMin = 0, usdMax = 0, usdGr = 0;

        if (r.TryGetProperty("portfolio_ars", out var ars))
        {
            if (ars.TryGetProperty("patrimonio", out var arsP) && arsP.TryGetProperty("global", out var arsG))
            {
                arsIni = FirstValue(arsG, "mediana");
                arsEsp = LastValue(arsG, "mediana");
                arsMin = LastValue(arsG, "minimo");
                arsMax = LastValue(arsG, "maximo");
            }
            if (ars.TryGetProperty("ganancias_reales", out var arsGrM) && arsGrM.TryGetProperty("global", out var arsGrG))
                arsGr = LastValue(arsGrG, "mediana");
        }

        if (r.TryGetProperty("portfolio_usd", out var usd))
        {
            if (usd.TryGetProperty("patrimonio", out var usdP) && usdP.TryGetProperty("global", out var usdG))
            {
                usdIni = FirstValue(usdG, "mediana");
                usdEsp = LastValue(usdG, "mediana");
                usdMin = LastValue(usdG, "minimo");
                usdMax = LastValue(usdG, "maximo");
            }
            if (usd.TryGetProperty("ganancias_reales", out var usdGrM) && usdGrM.TryGetProperty("global", out var usdGrG))
                usdGr = LastValue(usdGrG, "mediana");
        }

        var mixed = arsIni > 0 && usdIni > 0;

        decimal? retornoArs = arsIni != 0 ? (arsEsp - arsIni) / arsIni : null;
        decimal? retornoUsd = usdIni != 0 ? (usdEsp - usdIni) / usdIni : null;
        decimal? realArs    = arsIni != 0 ? arsGr / arsIni : null;
        decimal? realUsd    = usdIni != 0 ? usdGr / usdIni : null;

        return new MetricasAgregadas(
            ValorEsperado:      mixed ? null : arsEsp + usdEsp,
            ValorMinimo:        mixed ? null : arsMin + usdMin,
            ValorMaximo:        mixed ? null : arsMax + usdMax,
            RetornoEsperadoPct: mixed ? null : retornoArs ?? retornoUsd,
            RendimientoRealPct: mixed ? null : realArs ?? realUsd,
            ValorInicialArs:        arsIni,
            ValorInicialUsd:        usdIni,
            ValorEsperadoArs:       arsEsp,
            ValorEsperadoUsd:       usdEsp,
            ValorMinimoArs:         arsMin,
            ValorMinimoUsd:         usdMin,
            ValorMaximoArs:         arsMax,
            ValorMaximoUsd:         usdMax,
            RetornoEsperadoPctArs:  retornoArs,
            RetornoEsperadoPctUsd:  retornoUsd,
            RendimientoRealPctArs:  realArs,
            RendimientoRealPctUsd:  realUsd);
    }

    private static decimal FirstValue(JsonElement statsEl, string key)
    {
        if (!statsEl.TryGetProperty(key, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return 0m;
        var first = arr.EnumerateArray().FirstOrDefault();
        return first.ValueKind == JsonValueKind.Undefined ? 0m : first.GetDecimal();
    }

    private static decimal LastValue(JsonElement statsEl, string key)
    {
        if (!statsEl.TryGetProperty(key, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return 0m;
        var last = arr.EnumerateArray().LastOrDefault();
        return last.ValueKind == JsonValueKind.Undefined ? 0m : last.GetDecimal();
    }

    // Redondea al mes calendario más cercano usando días reales (no resta de componentes Y/M — eso
    // truncaba a 0 meses cualquier vencimiento dentro del mismo mes calendario que "hoy", aunque
    // faltaran semanas reales, y el motor trataba eso como "ya vencido" sin devengar ningún interés.
    private static int MesesEntre(DateOnly desde, DateOnly hasta)
        => (int)Math.Round((hasta.DayNumber - desde.DayNumber) / 30.436875, MidpointRounding.AwayFromZero);
}

// ── Constructor del payload del motor ─────────────────────────────────────────

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

            // flujo_bono está normalizado a VN 100 (un lote); se escala por la cantidad de lotes
            // de la tenencia para que la trayectoria simulada esté en la misma unidad que `monto`.
            object inst;
            if (b.Tipo == "bono_tasa_fija")
            {
                var flujos = flujosFuturos
                    .Select(f => new { mes = MesesEntre(today, f.FechaPago), monto = (double)((f.MontoCupon + f.MontoCapital) * b.Cantidad) })
                    .ToArray();
                inst = new { id = ambito, tipo = b.Tipo, monto = (double)monto, flujos, tir = (double)b.TasaDescuento };
            }
            else
            {
                var flujos_base = flujosFuturos
                    .Select(f => new { mes = MesesEntre(today, f.FechaPago), capital_adj = (double)(f.MontoCapital * b.Cantidad), interest_adj = (double)(f.MontoCupon * b.Cantidad) })
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
            var fv      = pf.FechaInicio.AddDays(pf.DuracionDias);
            var tVenc   = MesesEntre(today, fv);
            var tipo    = ResolveTipoPlazoFijo(pf);

            // El motor arranca su reloj en "hoy" (t=0) y toma `monto` como V(0) tal cual. Si
            // fechaInicio ya quedó en el pasado, el capital real hoy incluye el interés devengado
            // desde entonces — sin este ajuste, V(0) subestima el capital para todo depósito cuya
            // fechaInicio no sea exactamente hoy. Los instrumentos vencidos (sin reinvertir) nunca
            // llegan acá: SimularAsync ya los bloquea antes de construir el payload.
            var monto = CapitalDevengado(pf.MontoInvertido, pf.TnaPactada, MesesEntre(pf.FechaInicio, today));

            object inst;
            if (pf.TipoCodigo == "UVA")
            {
                inst = new
                {
                    id               = ambito,
                    tipo,
                    monto            = (double)monto,
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
                    monto        = (double)monto,
                    tna          = (double)pf.TnaPactada,
                    t_venc_meses = tVenc,
                    reinvertir   = pf.ReinvertirAlVencimiento
                };
            }
            instrumentos.Add(inst);
            snapshots.Add(new InstrumentoSimulacionSnapshot(
                ambito, tipo, null, null, null, pf.IdPortfolioPlazoFijo, monto,
                JsonSerializer.Serialize(inst),
                pf.EntidadFinanciera, pf.NombreTipoPlazoFijo, pf.MonedaCodigo));
        }

        var escenariosPayload = new Dictionary<string, object>();
        foreach (var e in escenarios)
        {
            escenariosPayload[e.Codigo.ToLowerInvariant()] = new
            {
                inflacion_mensual_min     = (double)e.InflacionMensualMin,
                inflacion_mensual_max     = (double)e.InflacionMensualMax,
                inflacion_mensual_min_usd = (double)e.InflacionMensualMinUsd,
                inflacion_mensual_max_usd = (double)e.InflacionMensualMaxUsd
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

    // Redondea al mes calendario más cercano usando días reales (no resta de componentes Y/M — eso
    // truncaba a 0 meses cualquier vencimiento dentro del mismo mes calendario que "hoy", aunque
    // faltaran semanas reales, y el motor trataba eso como "ya vencido" sin devengar ningún interés.
    private static int MesesEntre(DateOnly desde, DateOnly hasta)
        => (int)Math.Round((hasta.DayNumber - desde.DayNumber) / 30.436875, MidpointRounding.AwayFromZero);

    /// Capitaliza mensualmente a la TNA/tasa pactada — misma convención que usa el motor (r_m = tasa/12)
    /// para llevar el capital hasta la fecha de corte (normalmente "hoy").
    private static decimal CapitalDevengado(decimal montoInvertido, decimal tasaAnual, int mesesTranscurridos)
    {
        if (mesesTranscurridos <= 0) return montoInvertido;
        var rm = tasaAnual / 12m;
        return montoInvertido * (decimal)Math.Pow((double)(1 + rm), mesesTranscurridos);
    }
}

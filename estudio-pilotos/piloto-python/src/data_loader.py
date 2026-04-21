"""
Data loader para obtener datos históricos de acciones desde el JSON.
Calcula retorno esperado y volatilidad (parámetros del GBM).
"""
import json
from datetime import datetime
from typing import Dict, List, Tuple
import math


class DatosAccionesLoader:
    """Carga y procesa datos históricos de acciones."""

    def __init__(self, json_path: str):
        """
        Args:
            json_path: Ruta al archivo JSON con datos históricos
        """
        with open(json_path, 'r') as f:
            self.data = json.load(f)

        self.symbol = self.data['Meta Data']['2. Symbol']
        self.time_series = self.data['Time Series (Daily)']

    def get_series_ordenada(self) -> List[Tuple[str, dict]]:
        """Retorna la serie ordenada por fecha (ascendente)."""
        fechas = sorted(self.time_series.keys())
        return [(fecha, self.time_series[fecha]) for fecha in fechas]

    def calcular_retornos_logaritmicos(self, n_dias_atras: int = 2520) -> List[float]:
        """
        Calcula retornos logarítmicos diarios.

        Args:
            n_dias_atras: Cantidad de días a considerar (default: 10 años ≈ 2520 días)

        Returns:
            Lista de retornos logarítmicos
        """
        serie = self.get_series_ordenada()

        if len(serie) < n_dias_atras:
            print(f"Advertencia: Se tienen {len(serie)} días, se solicitaron {n_dias_atras}")
            n_dias_atras = len(serie)

        # Tomar los últimos n_dias_atras
        serie = serie[-n_dias_atras:]

        retornos = []
        for i in range(1, len(serie)):
            precio_prev = float(serie[i-1][1]['4. close'])
            precio_actual = float(serie[i][1]['4. close'])

            if precio_prev > 0:
                retorno_log = math.log(precio_actual / precio_prev)
                retornos.append(retorno_log)

        return retornos

    def calcular_parametros_gbm(self, n_dias_atras: int = 2520) -> Tuple[float, float]:
        """
        Calcula μ (media de retornos) y σ (volatilidad).

        Args:
            n_dias_atras: Cantidad de días históricos a considerar

        Returns:
            Tupla (mu, sigma) donde:
            - mu: retorno esperado anual
            - sigma: volatilidad anual
        """
        retornos = self.calcular_retornos_logaritmicos(n_dias_atras)

        if len(retornos) == 0:
            return 0.0, 0.0

        # Media de retornos diarios
        media_diaria = sum(retornos) / len(retornos)

        # Varianza de retornos diarios
        varianza_diaria = sum((r - media_diaria) ** 2 for r in retornos) / len(retornos)
        volatilidad_diaria = math.sqrt(varianza_diaria)

        # Anualizacion (252 días de trading por año)
        mu_anual = media_diaria * 252
        sigma_anual = volatilidad_diaria * math.sqrt(252)

        return mu_anual, sigma_anual

    def get_precio_inicial(self) -> float:
        """Retorna el precio de cierre más reciente."""
        serie = self.get_series_ordenada()
        if serie:
            return float(serie[-1][1]['4. close'])
        return 0.0

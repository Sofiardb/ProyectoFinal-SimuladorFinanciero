from flask import Blueprint, jsonify, request

from app.simulacion.orquestador import simular_portfolio

api_bp = Blueprint('api', __name__)


@api_bp.route('/ping', methods=['GET'])
def ping():
    return jsonify({'estado': 'ok'}), 200


@api_bp.route('/simular', methods=['POST'])
def simular():
    parametros = request.get_json()
    resultado = simular_portfolio(parametros)
    return jsonify(resultado), 200

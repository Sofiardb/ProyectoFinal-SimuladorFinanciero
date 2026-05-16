from flask import Blueprint, jsonify, request

api_bp = Blueprint('api', __name__)


@api_bp.route('/ping', methods=['GET'])
def ping():
    return jsonify({'estado': 'ok'}), 200


@api_bp.route('/simular', methods=['POST'])
def simular():
    # Se implementa cuando el orquestador Monte Carlo esté completo
    return jsonify({'error': 'No implementado aún'}), 501

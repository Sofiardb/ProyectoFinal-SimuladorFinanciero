from flask import Flask

from app.api.rutas import api_bp


def crear_app():
    app = Flask(__name__)
    app.register_blueprint(api_bp)
    return app

import pytest

from app import crear_app


@pytest.fixture
def app():
    app = crear_app()
    app.config['TESTING'] = True
    yield app


@pytest.fixture
def cliente(app):
    return app.test_client()

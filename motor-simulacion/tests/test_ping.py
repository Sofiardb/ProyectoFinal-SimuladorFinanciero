def test_ping_devuelve_ok(cliente):
    respuesta = cliente.get('/ping')
    assert respuesta.status_code == 200
    assert respuesta.get_json()['estado'] == 'ok'

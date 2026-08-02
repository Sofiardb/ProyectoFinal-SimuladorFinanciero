import os

from app import crear_app

app = crear_app()

if __name__ == '__main__':
    puerto = int(os.environ.get('PORT', 5050))
    app.run(host='0.0.0.0', port=puerto, debug=False)

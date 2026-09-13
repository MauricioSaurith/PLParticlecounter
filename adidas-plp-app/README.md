# PLP Article Counter · Adidas US

App pequeña lista para subir a GitHub e importar en Vercel. Conserva la consulta JSON con `curl_cffi` e `impersonate="chrome"` que funcionó en el script original adaptado a US. No utiliza Playwright.

## Qué permite hacer

- Pegar una PLP como `https://www.adidas.com/us/men-running-shoes`.
- Ver el total anunciado y cargar todos los productos, página por página.
- Comprobar IDs únicos, total constante y primera página estable al finalizar.
- Ver precio medio y cantidad de productos con descuento.
- Descargar un `.xlsx` real con filtros, encabezados fijos, precios numéricos y enlaces.

**Columnas del Excel:** ID, nombre, descripción breve, precio actual USD, precio original USD, descuento porcentual, moneda, categoría, deporte, división, tallas publicadas, cantidad de variantes listadas, valoración, número de reseñas, indicador de pedido y enlace.

Los campos ausentes quedan vacíos. Las tallas omiten el marcador `hidden`. Las variantes son la cantidad de IDs que la API publica en `colorVariations`; no se suman al conteo. No se consultan fichas individuales ni inventarios por talla. El indicador `orderable` no garantiza stock de una talla concreta. Los descuentos se calculan con `price` y `salePrice`.

## Publicar en Vercel desde GitHub

1. Crea un repositorio en GitHub y sube **el contenido de esta carpeta** a la raíz: `app.py`, `scraper.py`, `requirements.txt`, `vercel.json`, `.python-version`, `public/`, `templates/`, etc.
2. En Vercel, selecciona **Add New → Project** e importa ese repositorio.
3. Vercel debe reconocer **Flask**. Root Directory: la raíz del repositorio (o esta subcarpeta si la subiste dentro de otra). No establezcas un directorio de salida ni un comando de compilación de frontend. Conserva Python 3.12.
4. Pulsa **Deploy**. No requiere claves de API ni base de datos.
5. Abre la URL publicada, usa el ejemplo y comprueba la consulta y la descarga de Excel.

La estructura sigue la documentación oficial de [Flask en Vercel](https://vercel.com/docs/frameworks/backend/flask): `app.py` exporta `app`, los archivos públicos están en `public/`, y `vercel.json` establece 60 segundos por solicitud.

**Pendiente de validar:** no se ha desplegado en una cuenta de Vercel. La instalación, ejecución y consulta real se probaron localmente. Adidas puede tratar de forma distinta las IP de Vercel; si allí devuelve 403, la app mostrará ese error y no fabricará resultados. El éxito local no garantiza el acceso desde Vercel.

## Ejecutar localmente

Python 3.12 recomendado:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abre `http://127.0.0.1:5055`. En Windows activa el entorno con `.venv\Scripts\activate`.

## Cómo funciona

`POST /api/page` consulta una sola página de Adidas por solicitud. La interfaz acumula los resultados y deja una pausa entre páginas. Así no necesita mantener una función de Vercel abierta durante todo el catálogo.

El endpoint upstream está fijado a `https://www.adidas.com/api/plp/content-engine`, con `sitePath=us`, `query=<segmento de la PLP>` y `start=<posición>`. No acepta dominios arbitrarios ni sigue redirecciones.

`POST /api/export` genera el Excel en memoria a partir de las filas cargadas en la sesión. Revisa cantidad e IDs únicos; no vuelve a consultar Adidas. Los datos enviados por el navegador no constituyen un certificado de autenticidad. No se guardan resultados ni historial en el servidor. Recargar la página borra el resultado.

## Alcance y límites

- Solo Adidas US: `https://www.adidas.com/us/<plp>`.
- Admite `?start=48` (cuenta desde el inicio). Otros parámetros se rechazan para no ignorar silenciosamente filtros cuya correspondencia con la API no está comprobada.
- Hasta 3.000 productos para cargar/exportar. Para una categoría mayor se muestra el total y se pide una categoría más específica.
- No expande colores de una tarjeta ni agrupa IDs diferentes por modelo.
- Un fallo a mitad del recorrido deja visible el total anunciado y los datos parciales, pero deshabilita el Excel y marca el listado sin verificar.
- La consistencia no equivale a una fotografía atómica: el catálogo puede cambiar durante las solicitudes, incluso conservando el total.
- App sin autenticación, cuotas por usuario ni historial. Está pensada para uso pequeño. Si la compartes ampliamente, configura protección de acceso/rate limiting en Vercel según tu uso y plan.
- La presentación no fue sometida a una prueba visual automatizada en navegador; se verificaron las rutas, el JavaScript y los endpoints.

## Verificación realizada

En la prueba real de esta app, la PLP de ejemplo devolvió **235 productos**. Se recorrieron todas las páginas, se comprobaron 235 IDs únicos y se generó/abrió el Excel con 235 filas de datos (240 filas contando metadatos y encabezado). Es una observación de esa ejecución, no un total fijo.

Nueve pruebas automáticas cubren URLs, cálculo de precios, JSON inválido, bloqueo HTTP 403, duplicados, Excel, texto que parece fórmula, exportación incompleta, categoría vacía y rutas públicas (algunas pruebas cubren más de un caso):

```sh
python -m unittest discover -s tests -v
```

## Archivos

- `app.py`: rutas web y exportación Excel.
- `scraper.py`: consulta a Adidas y campos de producto.
- `templates/index.html`: interfaz.
- `public/app.js`: carga progresiva y comprobaciones.
- `public/style.css`: estilos adaptables a móvil.
- `vercel.json`, `.python-version`, `requirements.txt`: configuración.

Referencia del scraper original: https://github.com/quochuy242/AdidasScraper

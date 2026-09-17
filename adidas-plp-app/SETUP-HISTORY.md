# Activar el historial diario

El código está preparado; el historial no está activo hasta conectar Supabase y desplegar.

1. Entra en https://supabase.com/dashboard y crea un proyecto para esta app.
   Conserva la contraseña de la base de datos en tu gestor de contraseñas.
2. En el proyecto, abre **SQL Editor** y ejecuta `supabase/schema.sql`.
3. Ejecuta `supabase/initial-observation-2026-09-17.sql`: contiene los tres
   conteos reales consultados el 17 de septiembre con sus horas de observación.
4. En **Vercel → proyecto → Settings → Environment Variables**, configura para Production:
   - `SUPABASE_URL`: URL de tu proyecto Supabase.
   - `SUPABASE_SECRET_KEY`: clave secreta de servidor del proyecto Supabase.
   - `CRON_SECRET`: un secreto aleatorio de al menos 32 caracteres, generado en tu gestor de contraseñas.
   No compartas las claves en el chat, no las agregues al repositorio y no uses la clave pública.
5. Despliega el código actualizado. **Root Directory** sigue siendo `adidas-plp-app`.
6. En Vercel, abre **Cron Jobs** y ejecuta la tarea del catálogo para comprobarla.
   Después abre **Catalog history** en la app.

La tarea consulta US, CA inglés y CA francés diariamente a las 13:00 UTC (8:00 a. m.
Bogotá). En Hobby puede ejecutarse dentro de esa hora, sin precisión de minuto.
El navegador no tiene que permanecer abierto para el conteo diario. Las descargas
completas de productos sí requieren mantener la pestaña abierta hasta terminar.

Se guarda el primer conteo exitoso de cada catálogo y día; un reintento fallido no
lo reemplaza. Los fallos se muestran como datos faltantes, nunca como cero.
El gráfico necesita al menos dos días de datos para mostrar una línea de tendencia.

Los totales son los de las listas de Adidas, que pueden incluir artículos agotados.
No se suman Canadá inglés y francés. El historial guarda conteos, no copias diarias
de todos los productos. El Excel contiene los productos de la consulta actual.

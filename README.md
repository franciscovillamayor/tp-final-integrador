# SerieScore

SerieScore es una aplicación web responsive para descubrir y organizar películas y series.

## Requisitos

- Node.js 18 o superior
- Una base de datos MySQL compatible (por ejemplo, TiDB Cloud)

## Instalación

1. Instalá las dependencias:
   ```bash
   npm install
   ```

2. Creá tu configuración local a partir de la plantilla:
   ```bash
   copy .env.example .env
   ```

3. Completá en `.env` la conexión a la base de datos, los secretos JWT y los proveedores opcionales.

4. Inicializá la base de datos:
   ```bash
   node Scripts/init-db.js
   ```

5. Iniciá la aplicación:
   ```bash
   npm start
   ```

6. Abrí `http://localhost:3000`.

La aplicación móvil Expo puede iniciarse con:
```bash
npm run mobile
```

Los archivos `.env`, certificados, dependencias y datos locales deben mantenerse fuera del repositorio. No incluyas contraseñas reales en `.env.example`.

# Los Barriles OS

Sistema de gestion para el restaurante Los Barriles, con modulos de TPV, reservas, inventario, compras, finanzas, personal e IA.

## Desarrollo local

1. Instala dependencias: `npm install`
2. Copia `.env.example` a `.env` y rellena `GEMINI_API_KEY`.
3. Arranca la app: `npm run dev`

## Despliegue en Vercel

Configura estas variables en **Project Settings > Environment Variables**:

- `GEMINI_API_KEY`: clave privada de Gemini. Marcala como sensitive.
- `APP_ORIGINS`: origenes permitidos separados por coma, por ejemplo `https://los-barriles-os.vercel.app`.
- `GEMINI_RATE_LIMIT_PER_MINUTE`: opcional, por defecto `30`.
- `GEMINI_MAX_REQUEST_BYTES`: opcional, por defecto `8000000`.

No subas archivos `.env` al repositorio. Si alguna clave se publico, revocala en Google AI Studio y crea una nueva.

## Seguridad operativa

- La clave de Gemini se usa solo en la funcion `/api/gemini` de Vercel.
- El cliente ya no envia claves de API propias.
- Firestore limita las escrituras de gerente al correo propietario configurado en `firestore.rules`.
- Manten un unico proyecto Vercel como produccion para evitar variables y dominios duplicados.

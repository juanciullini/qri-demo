# Instrucciones para la Presentación QRi

## Instalar Marp CLI

```bash
npm install -g @marp-team/marp-cli
```

O usar npx sin instalar:

```bash
npx @marp-team/marp-cli presentacion-qri.md
```

## Generar la presentación

### Vista previa en navegador (con hot reload)
```bash
cd presentacion
npx @marp-team/marp-cli -s .
```
Abre http://localhost:8080 en el navegador.

### Exportar a PDF
```bash
npx @marp-team/marp-cli presentacion-qri.md -o presentacion-qri.pdf
```

### Exportar a HTML (standalone)
```bash
npx @marp-team/marp-cli presentacion-qri.md -o presentacion-qri.html
```

### Exportar a PPTX (PowerPoint)
```bash
npx @marp-team/marp-cli presentacion-qri.md -o presentacion-qri.pptx
```

## Screenshots necesarios

Guardá las capturas en la carpeta `screenshots/` con estos nombres:

| Archivo | Qué capturar | Ruta en el sistema |
|---------|-------------|-------------------|
| `dashboard.png` | Dashboard completo con gráficos y stats | `/` |
| `comercios-listado.png` | Tabla de comercios con datos | `/merchants` |
| `comercio-formulario.png` | Formulario de alta/edición de comercio | `/merchants/new` |
| `comercio-detalle.png` | Detalle de un comercio con stats y QR | `/merchants/:id` |
| `qr-generacion.png` | Pantalla de generación de QR (con preview) | `/qr/generate` |
| `qr-listado.png` | Grilla de QR codes | `/qr` |
| `billetera-escaneo.png` | Paso 1 del wallet: escaneo de QR | `/wallet` |
| `billetera-confirmacion.png` | Paso 2 y/o 3: confirmación/resultado | `/wallet` |
| `transacciones-listado.png` | Listado de transacciones con filtros | `/transactions` |
| `transaccion-detalle.png` | Detalle con timeline y mensajes Coelsa | `/transactions/:id` |
| `liquidaciones.png` | Listado o detalle de liquidación | `/settlements` |
| `comisiones-dashboard.png` | Dashboard de comisiones con gráficos | `/commissions` |
| `comisiones-perfiles.png` | Perfiles de comisión | `/commissions/profiles` |
| `usuarios.png` | Listado de usuarios con roles | `/users` |
| `sistema.png` | Panel de sistema con health y sandbox | `/system` |

### Tips para los screenshots

- Usá resolución **1920x1080** o mayor para que se vean nítidos
- Asegurate de tener **datos de ejemplo** cargados (seed: `npm run db:seed`)
- Para el dashboard, esperá a que carguen los gráficos
- Para transacciones, es ideal tener varias en distintos estados
- El panel de sistema muestra más info si hay conexión activa (o sandbox)
- Podés usar la extensión del navegador "GoFullPage" para capturas completas

# EAs Precompilados

Este directorio contiene los EAs (Expert Advisors) precompilados que se sirven a los clientes.

## Archivos necesarios

- `TBSSignalEA.ex4` - EA compilado para MetaTrader 4
- `TBSSignalEA.ex5` - EA compilado para MetaTrader 5

## Cómo compilar los EAs

### MT5

1. Abre MetaEditor 5 (viene con MT5)
2. Abre el archivo fuente: `mt5/TBSSignalEA.mq5`
3. Ve a **Tools > Compile** (o presiona F7)
4. El archivo compilado se generará en `mt5/Experts/TBSSignalEA.ex5`
5. Copia el archivo `.ex5` a este directorio (`public/eas/`)

### MT4

1. Abre MetaEditor 4 (viene con MT4)
2. Abre el archivo fuente: `mt4/TBSSignalEA.mq4`
3. Ve a **File > Compile** (o presiona F7)
4. El archivo compilado se generará en `mt4/Experts/TBSSignalEA.ex4`
5. Copia el archivo `.ex4` a este directorio (`public/eas/`)

## Compilación automatizada (opcional)

Para compilar desde línea de comandos en Windows:

```powershell
# MT5
& "C:\Program Files\MetaTrader 5\metaeditor64.exe" /compile:"path\to\TBSSignalEA.mq5" /log

# MT4
& "C:\Program Files\MetaTrader 4\metaeditor.exe" /compile:"path\to\TBSSignalEA.mq4" /log
```

## Verificación

Después de compilar, verifica que los archivos tienen un tamaño razonable:

- `TBSSignalEA.ex4` - ~15-30 KB
- `TBSSignalEA.ex5` - ~20-40 KB

## Seguridad

- **NO** subas los archivos `.mq4` o `.mq5` a este directorio
- Solo los archivos compilados (`.ex4` y `.ex5`) se sirven a los clientes
- Los archivos fuente están en `mt4/` y `mt5/` respectivamente

## Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | 2026-03-07 | Versión inicial |

## Actualización de EAs

1. Modifica el código fuente en `mt4/` o `mt5/`
2. Recompila el EA
3. Copia el nuevo archivo compilado a este directorio
4. Actualiza la tabla de versiones arriba
5. Haz commit y push al repositorio

El endpoint de descarga (`/api/bot/ea/mt4` o `/api/bot/ea/mt5`) servirá automáticamente la última versión.

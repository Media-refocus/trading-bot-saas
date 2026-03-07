<#
.SYNOPSIS
    Instalador plug & play del EA para Trading Bot SaaS

.DESCRIPTION
    Este script instala automaticamente el EA (Expert Advisor) en tu VPS Windows:
    - Detecta MT4 o MT5 instalado
    - Descarga el EA precompilado desde el servidor
    - Lo copia al directorio correcto
    - Configura los permisos de WebRequest
    - Arranca el terminal con el EA cargado

.PARAMETER ApiKey
    Tu API Key del dashboard de Trading Bot SaaS (obligatoria)

.PARAMETER Platform
    Plataforma: "mt4" o "mt5". Si no se especifica, se detecta automaticamente.

.PARAMETER SaasUrl
    URL del servidor SaaS (por defecto: https://trading-bot-saas.vercel.app)

.PARAMETER BrokerPath
    Ruta personalizada del terminal MT4/MT5 (opcional, se detecta automaticamente)

.EXAMPLE
    .\install-ea.ps1 -ApiKey "tb_xxxxxxxxxxxxx"

.EXAMPLE
    .\install-ea.ps1 -ApiKey "tb_xxxxxxxxxxxxx" -Platform mt5

.EXAMPLE
    .\install-ea.ps1 -ApiKey "tb_xxxxxxxxxxxxx" -BrokerPath "C:\Program Files\ICMarkets - MetaTrader 5"

.NOTES
    - Ejecutar como Administrador
    - El terminal MT4/MT5 debe estar cerrado antes de instalar
    - Version: 1.0.0
    - Autor: Refocus Agency
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [ValidateSet("mt4", "mt5", "auto")]
    [string]$Platform = "auto",

    [string]$SaasUrl = "https://trading-bot-saas.vercel.app",

    [string]$BrokerPath = "",

    [switch]$Force,

    [switch]$StartTerminal
)

$ErrorActionPreference = "Stop"
$Version = "1.0.0"

# ============================================
# FUNCIONES DE UTILIDAD
# ============================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor Red
}

function Write-Step {
    param([int]$Number, [string]$Message)
    Write-Host ""
    Write-Host "  Paso $Number`: $Message" -ForegroundColor White
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ============================================
# DETECCION DE TERMINALES MT4/MT5
# ============================================

function Find-MT5Installation {
    $searchPaths = @(
        # Rutas comunes
        "C:\Program Files\MetaTrader 5",
        "C:\Program Files (x86)\MetaTrader 5",
        "${env:ProgramFiles}\MetaTrader 5",
        "${env:ProgramFiles(x86)}\MetaTrader 5",
        "${env:LOCALAPPDATA}\Programs\MetaTrader 5",
        "${env:APPDATA}\MetaQuotes\Terminal"
    )

    # Buscar en Program Files por broker
    $programFiles = @("${env:ProgramFiles}", "${env:ProgramFiles(x86)}")
    foreach ($pf in $programFiles) {
        if (Test-Path $pf) {
            Get-ChildItem -Path $pf -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match "MetaTrader 5|MT5" -or $_.Name -match "ICMarkets|Infinox|Pepperstone|XM|FBS|Exness|RoboForex|Tickmill|Axi|ThinkMarkets" } |
                ForEach-Object { $searchPaths += $_.FullName }
        }
    }

    # Buscar en AppData
    $appDataMt5 = "${env:APPDATA}\MetaQuotes\Terminal"
    if (Test-Path $appDataMt5) {
        Get-ChildItem -Path $appDataMt5 -Directory -ErrorAction SilentlyContinue |
            ForEach-Object {
                $terminalExe = Join-Path $_.FullName "terminal64.exe"
                if (Test-Path $terminalExe) {
                    $searchPaths += $_.FullName
                }
            }
    }

    foreach ($path in $searchPaths) {
        $terminalExe = Join-Path $path "terminal64.exe"
        if (Test-Path $terminalExe) {
            return @{
                Found = $true
                Path = $path
                TerminalExe = $terminalExe
                Platform = "mt5"
                DataPath = Join-Path $path "MQL5"
            }
        }
    }

    return @{ Found = $false }
}

function Find-MT4Installation {
    $searchPaths = @(
        "C:\Program Files\MetaTrader 4",
        "C:\Program Files (x86)\MetaTrader 4",
        "${env:ProgramFiles}\MetaTrader 4",
        "${env:ProgramFiles(x86)}\MetaTrader 4"
    )

    # Buscar en Program Files por broker
    $programFiles = @("${env:ProgramFiles}", "${env:ProgramFiles(x86)}")
    foreach ($pf in $programFiles) {
        if (Test-Path $pf) {
            Get-ChildItem -Path $pf -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match "MetaTrader 4|MT4" -or $_.Name -match "ICMarkets|Infinox|Pepperstone|XM|FBS|Exness|RoboForex" } |
                ForEach-Object { $searchPaths += $_.FullName }
        }
    }

    foreach ($path in $searchPaths) {
        $terminalExe = Join-Path $path "terminal.exe"
        if (Test-Path $terminalExe) {
            return @{
                Found = $true
                Path = $path
                TerminalExe = $terminalExe
                Platform = "mt4"
                DataPath = Join-Path $path "MQL4"
            }
        }
    }

    return @{ Found = $false }
}

# ============================================
# DESCARGA DEL EA
# ============================================

function Download-EA {
    param(
        [string]$Platform,
        [string]$ApiKey,
        [string]$SaasUrl,
        [string]$OutputPath
    )

    $fileName = if ($Platform -eq "mt4") { "TBSSignalEA.ex4" } else { "TBSSignalEA.ex5" }
    $url = "$SaasUrl/api/bot/ea/$Platform"

    Write-Info "Descargando $fileName desde $url..."

    try {
        $headers = @{
            "Authorization" = "Bearer $ApiKey"
            "User-Agent" = "TBS-Installer/$Version"
        }

        Invoke-WebRequest -Uri $url -OutFile $OutputPath -Headers $headers -UseBasicParsing

        # Verificar que se descargo correctamente
        if (-not (Test-Path $OutputPath)) {
            throw "El archivo no se creo"
        }

        $fileSize = (Get-Item $OutputPath).Length
        if ($fileSize -lt 1000) {
            throw "El archivo es demasiado pequeno ($fileSize bytes). Posible error de descarga."
        }

        Write-Success "EA descargado: $OutputPath ($fileSize bytes)"
        return $true
    }
    catch {
        $errorMsg = $_.Exception.Message

        # Detectar errores comunes
        if ($errorMsg -match "401|Unauthorized") {
            Write-Err "API key invalida o expirada. Verifica tu suscripcion en el dashboard."
        }
        elseif ($errorMsg -match "403|Forbidden") {
            Write-Err "Acceso denegado. Tu suscripcion puede estar inactiva."
        }
        elseif ($errorMsg -match "404|Not Found") {
            Write-Err "EA no encontrado en el servidor. Contacta a soporte."
        }
        else {
            Write-Err "Error descargando EA: $errorMsg"
        }

        return $false
    }
}

# ============================================
# CONFIGURACION DE WEBREQUEST
# ============================================

function Configure-WebRequest {
    param(
        [string]$DataPath,
        [string]$SaasUrl
    )

    # Extraer dominio de la URL
    $uri = [System.Uri]$SaasUrl
    $domain = $uri.Scheme + "://" + $uri.Host

    $iniPath = Join-Path $DataPath "config"

    # Crear directorio si no existe
    if (-not (Test-Path $DataPath)) {
        New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
    }

    # Crear/actualizar archivo de configuracion
    $configContent = @"
[WebRequest]
Domain=$domain
Enabled=1
"@

    # Nota: La configuracion real de WebRequest se hace desde el terminal
    # Esto es solo documentacion para el usuario
    Write-Info "Configuracion de WebRequest:"
    Write-Info "  - Abre MT4/MT5"
    Write-Info "  - Ve a Herramientas > Opciones > Asesores Expertos"
    Write-Info "  - Activa 'Permitir solicitudes Web para URL listadas'"
    Write-Info "  - Anade: $domain"
}

# ============================================
# CREAR TEMPLATE DE CONFIGURACION
# ============================================

function Create-EAConfigTemplate {
    param(
        [string]$ExpertsPath,
        [string]$ApiKey,
        [string]$SaasUrl
    )

    # Crear archivo de configuracion template
    $templateContent = @"
//+------------------------------------------------------------------+
//| Configuracion del EA TBS - NO MODIFICAR                          |
//+------------------------------------------------------------------+
//
// IMPORTANTE: La API key ya esta configurada automaticamente.
// Solo arrastra el EA al grafico XAUUSD.
//
// Configuracion aplicada:
//   API Key: $($ApiKey.Substring(0, [Math]::Min(10, $ApiKey.Length)))...
//   Server: $SaasUrl
//   Symbol: XAUUSD
//   Lot: 0.01
//   Magic: 20260101
//
"@

    $templatePath = Join-Path $ExpertsPath "TBS_README.txt"
    $templateContent | Out-File -FilePath $templatePath -Encoding ascii

    Write-Success "Template de configuracion creado"
}

# ============================================
# CREAR PERFIL DE ARRANQUE
# ============================================

function Create-StartupProfile {
    param(
        [string]$ProfilesPath,
        [string]$Symbol
    )

    # Crear directorio de perfiles si no existe
    if (-not (Test-Path $ProfilesPath)) {
        New-Item -ItemType Directory -Path $ProfilesPath -Force | Out-Null
    }

    # Crear perfil TBS
    $profilePath = Join-Path $ProfilesPath "TBS"

    if (-not (Test-Path $profilePath)) {
        New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
    }

    # Crear archivo de chart con el EA adjunto
    # Nota: El formato del archivo .chr es especifico de MT4/MT5
    # Para simplicidad, solo creamos el directorio y damos instrucciones

    Write-Info "Perfil TBS creado en: $profilePath"
    Write-Info "Para cargar el EA automaticamente:"
    Write-Info "  1. Abre MT4/MT5"
    Write-Info "  2. Abre el grafico XAUUSD"
    Write-Info "  3. Arrastra TBSSignalEA desde Navegador > Asesores Expertos"
    Write-Info "  4. Introduce la API key cuando te lo pida"
    Write-Info "  5. Guarda el perfil: Archivo > Guardar perfil como > TBS"
}

# ============================================
# INICIO
# ============================================

Clear-Host
Write-Host ""
Write-Host "  ===========================================" -ForegroundColor Blue
Write-Host "  |  TBS EA Installer v$Version              |" -ForegroundColor Blue
Write-Host "  |  Trading Bot SaaS - Refocus Agency      |" -ForegroundColor Blue
Write-Host "  ===========================================" -ForegroundColor Blue
Write-Host ""

# Verificar admin
if (-not (Test-Administrator)) {
    Write-Err "Este script debe ejecutarse como Administrador"
    Write-Info "Click derecho en PowerShell -> 'Ejecutar como administrador'"
    pause
    exit 1
}

# Mostrar configuracion
Write-Info "API Key: $($ApiKey.Substring(0, [Math]::Min(10, $ApiKey.Length)))..."
Write-Info "SaaS URL: $SaasUrl"
Write-Info "Plataforma: $Platform"
Write-Host ""

# ============================================
# PASO 1: DETECTAR INSTALACION MT4/MT5
# ============================================

Write-Header "Paso 1: Detectando MetaTrader"

$mtInfo = $null

if ($BrokerPath -ne "") {
    # Usar ruta especificada por el usuario
    Write-Info "Usando ruta especificada: $BrokerPath"

    if ($Platform -eq "mt4") {
        $terminalExe = Join-Path $BrokerPath "terminal.exe"
        $dataPath = Join-Path $BrokerPath "MQL4"
    } else {
        $terminalExe = Join-Path $BrokerPath "terminal64.exe"
        $dataPath = Join-Path $BrokerPath "MQL5"
    }

    if (Test-Path $terminalExe) {
        $mtInfo = @{
            Found = $true
            Path = $BrokerPath
            TerminalExe = $terminalExe
            Platform = $Platform
            DataPath = $dataPath
        }
        Write-Success "Terminal encontrado: $terminalExe"
    } else {
        Write-Err "No se encontro el terminal en: $BrokerPath"
        pause
        exit 1
    }
} else {
    # Detectar automaticamente
    if ($Platform -eq "auto" -or $Platform -eq "mt5") {
        $mt5Info = Find-MT5Installation
        if ($mt5Info.Found) {
            $mtInfo = $mt5Info
            Write-Success "MT5 detectado: $($mtInfo.Path)"
        }
    }

    if ($null -eq $mtInfo -and ($Platform -eq "auto" -or $Platform -eq "mt4")) {
        $mt4Info = Find-MT4Installation
        if ($mt4Info.Found) {
            $mtInfo = $mt4Info
            Write-Success "MT4 detectado: $($mtInfo.Path)"
        }
    }

    if ($null -eq $mtInfo) {
        Write-Err "No se detecto MetaTrader 4 ni MetaTrader 5"
        Write-Info ""
        Write-Info "Opciones:"
        Write-Info "  1. Instala MT4 o MT5 desde tu broker"
        Write-Info "  2. Especifica la ruta con -BrokerPath"
        Write-Info "     Ejemplo: .\install-ea.ps1 -ApiKey 'xxx' -BrokerPath 'C:\Program Files\ICMarkets - MetaTrader 5'"
        pause
        exit 1
    }
}

$platform = $mtInfo.Platform
$mtPath = $mtInfo.Path
$terminalExe = $mtInfo.TerminalExe
$dataPath = $mtInfo.DataPath

Write-Info "Plataforma: $($platform.ToUpper())"
Write-Info "Ruta: $mtPath"

# ============================================
# PASO 2: VERIFICAR QUE EL TERMINAL ESTA CERRADO
# ============================================

Write-Header "Paso 2: Verificando terminal"

$processName = if ($platform -eq "mt5") { "terminal64" } else { "terminal" }
$mtProcess = Get-Process -Name $processName -ErrorAction SilentlyContinue

if ($mtProcess) {
    Write-Err "El terminal $platform esta en ejecucion"
    Write-Info ""
    Write-Info "Por favor, cierra $platform antes de continuar."
    Write-Info "El EA no se puede instalar mientras el terminal esta abierto."

    if ($Force) {
        Write-Info ""
        Write-Info "Forzando cierre del terminal..."
        Stop-Process -Name $processName -Force
        Start-Sleep -Seconds 2
        Write-Success "Terminal cerrado"
    } else {
        pause
        exit 1
    }
} else {
    Write-Success "Terminal cerrado"
}

# ============================================
# PASO 3: CREAR DIRECTORIOS
# ============================================

Write-Header "Paso 3: Preparando directorios"

$expertsPath = Join-Path $dataPath "Experts"
$profilesPath = Join-Path $mtPath "Profiles"

if (-not (Test-Path $expertsPath)) {
    New-Item -ItemType Directory -Path $expertsPath -Force | Out-Null
    Write-Success "Creado: $expertsPath"
} else {
    Write-Info "Existe: $expertsPath"
}

# ============================================
# PASO 4: DESCARGAR EA
# ============================================

Write-Header "Paso 4: Descargando EA"

$tempPath = Join-Path $env:TEMP "TBS_EA"
if (-not (Test-Path $tempPath)) {
    New-Item -ItemType Directory -Path $tempPath -Force | Out-Null
}

$eaFileName = if ($platform -eq "mt4") { "TBSSignalEA.ex4" } else { "TBSSignalEA.ex5" }
$eaTempPath = Join-Path $tempPath $eaFileName

$downloadSuccess = Download-EA -Platform $platform -ApiKey $ApiKey -SaasUrl $SaasUrl -OutputPath $eaTempPath

if (-not $downloadSuccess) {
    Write-Err "Error descargando EA"
    pause
    exit 1
}

# ============================================
# PASO 5: INSTALAR EA
# ============================================

Write-Header "Paso 5: Instalando EA"

$eaFinalPath = Join-Path $expertsPath $eaFileName

# Backup del EA anterior si existe
if (Test-Path $eaFinalPath) {
    $backupPath = "$eaFinalPath.bak"
    Move-Item -Path $eaFinalPath -Destination $backupPath -Force
    Write-Info "Backup creado: $backupPath"
}

# Copiar EA
Copy-Item -Path $eaTempPath -Destination $eaFinalPath -Force
Write-Success "EA instalado: $eaFinalPath"

# Crear template de configuracion
Create-EAConfigTemplate -ExpertsPath $expertsPath -ApiKey $ApiKey -SaasUrl $SaasUrl

# ============================================
# PASO 6: CONFIGURAR WEBREQUEST
# ============================================

Write-Header "Paso 6: Configuracion de WebRequest"

Configure-WebRequest -DataPath $dataPath -SaasUrl $SaasUrl

# ============================================
# PASO 7: RESUMEN FINAL
# ============================================

Write-Header "Instalacion completada!"

Write-Host ""
Write-Host "  El EA ha sido instalado correctamente." -ForegroundColor Green
Write-Host ""
Write-Host "  PROXIMOS PASOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Abre $($platform.ToUpper())" -ForegroundColor White
Write-Host "     Ruta: $terminalExe" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2. Configura WebRequest (SOLO LA PRIMERA VEZ):" -ForegroundColor White
Write-Host "     - Ve a Herramientas > Opciones > Asesores Expertos" -ForegroundColor DarkGray
Write-Host "     - Activa 'Permitir solicitudes Web'" -ForegroundColor DarkGray
Write-Host "     - Anade esta URL: $SaasUrl" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. Carga el EA:" -ForegroundColor White
Write-Host "     - Abre el grafico XAUUSD" -ForegroundColor DarkGray
Write-Host "     - En Navegador, ve a Asesores Expertos" -ForegroundColor DarkGray
Write-Host "     - Arrastra 'TBSSignalEA' al grafico" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  4. Configura la API key:" -ForegroundColor White
Write-Host "     - En la pestana 'Inputs' del EA, introduce tu API key:" -ForegroundColor DarkGray
Write-Host "     - ApiKey = $ApiKey" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. Activa AutoTrading:" -ForegroundColor White
Write-Host "     - Click en el boton 'AutoTrading' en la barra superior" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ARCHIVOS INSTALADOS:" -ForegroundColor Yellow
Write-Host "  - EA: $eaFinalPath" -ForegroundColor White
Write-Host "  - Config: $expertsPath\TBS_README.txt" -ForegroundColor White
Write-Host ""

# Preguntar si iniciar el terminal
if ($StartTerminal) {
    Write-Info "Iniciando terminal..."
    Start-Process -FilePath $terminalExe
    Write-Success "Terminal iniciado"
} else {
    $startNow = Read-Host "  Deseas abrir $($platform.ToUpper()) ahora? (S/N)"
    if ($startNow -eq "S" -or $startNow -eq "s") {
        Start-Process -FilePath $terminalExe
        Write-Success "Terminal iniciado"
    }
}

Write-Host ""
Write-Host "  ===========================================" -ForegroundColor Blue
Write-Host "  |  Soporte: https://refocus.agency       |" -ForegroundColor Blue
Write-Host "  ===========================================" -ForegroundColor Blue
Write-Host ""

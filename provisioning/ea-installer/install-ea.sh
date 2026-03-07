#!/bin/bash
#
# Instalador plug & play del EA para Trading Bot SaaS
# Para VPS Linux con MT4/MT5 (via Wine)
#
# Uso:
#   ./install-ea.sh --api-key "tb_xxx" [--platform mt4|mt5] [--saas-url "https://..."]
#
# Requisitos:
#   - Wine instalado
#   - MT4 o MT5 instalado via Wine
#   - curl
#

set -e

# ============================================
# CONFIGURACION
# ============================================

VERSION="1.0.0"
DEFAULT_SAAS_URL="https://trading-bot-saas.vercel.app"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
API_KEY=""
PLATFORM="auto"
SAAS_URL="$DEFAULT_SAAS_URL"
MT_PATH=""
FORCE=false
START_TERMINAL=false

# ============================================
# FUNCIONES DE UTILIDAD
# ============================================

print_header() {
    echo ""
    echo -e "${CYAN}=========================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo ""
}

print_success() {
    echo -e "  ${GREEN}[OK]${NC} $1"
}

print_info() {
    echo -e "  ${YELLOW}[i]${NC} $1"
}

print_error() {
    echo -e "  ${RED}[X]${NC} $1"
}

print_step() {
    echo ""
    echo -e "  ${WHITE}Paso $1: $2${NC}"
}

show_banner() {
    clear
    echo ""
    echo -e "${BLUE}  ==========================================${NC}"
    echo -e "${BLUE}  |  TBS EA Installer v$VERSION              |${NC}"
    echo -e "${BLUE}  |  Trading Bot SaaS - Refocus Agency      |${NC}"
    echo -e "${BLUE}  ==========================================${NC}"
    echo ""
}

show_usage() {
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --api-key KEY       API Key del dashboard TBS (obligatoria)"
    echo "  --platform PLATFORM Plataforma: mt4, mt5 o auto (default: auto)"
    echo "  --saas-url URL      URL del servidor SaaS (default: $DEFAULT_SAAS_URL)"
    echo "  --mt-path PATH      Ruta al directorio de MT4/MT5"
    echo "  --force             Forzar instalacion si el terminal esta abierto"
    echo "  --start             Iniciar el terminal despues de instalar"
    echo "  --help              Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 --api-key \"tb_xxxxxxxxxxxxx\""
    echo "  $0 --api-key \"tb_xxx\" --platform mt5 --start"
    echo "  $0 --api-key \"tb_xxx\" --mt-path ~/.wine/drive_c/Program\ Files/MetaTrader\ 5"
}

# ============================================
# PARSEO DE ARGUMENTOS
# ============================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-key)
                API_KEY="$2"
                shift 2
                ;;
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --saas-url)
                SAAS_URL="$2"
                shift 2
                ;;
            --mt-path)
                MT_PATH="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --start)
                START_TERMINAL=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                print_error "Opcion desconocida: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Validar argumentos obligatorios
    if [[ -z "$API_KEY" ]]; then
        print_error "API Key es obligatoria"
        show_usage
        exit 1
    fi

    # Validar plataforma
    if [[ "$PLATFORM" != "auto" && "$PLATFORM" != "mt4" && "$PLATFORM" != "mt5" ]]; then
        print_error "Plataforma invalida: $PLATFORM. Usa mt4, mt5 o auto."
        exit 1
    fi
}

# ============================================
# DETECCION DE MT4/MT5
# ============================================

find_mt_installation() {
    print_header "Detectando MetaTrader"

    # Buscar en directorios comunes de Wine
    local search_paths=(
        "$HOME/.wine/drive_c/Program Files/MetaTrader 5"
        "$HOME/.wine/drive_c/Program Files/MetaTrader 4"
        "$HOME/.wine/drive_c/Program Files (x86)/MetaTrader 5"
        "$HOME/.wine/drive_c/Program Files (x86)/MetaTrader 4"
        "$HOME/.wine32/drive_c/Program Files/MetaTrader 5"
        "$HOME/.wine32/drive_c/Program Files/MetaTrader 4"
        "/opt/metatrader5"
        "/opt/metatrader4"
        "/usr/share/metatrader5"
        "/usr/share/metatrader4"
    )

    # Buscar por broker
    for broker_path in "$HOME/.wine/drive_c/Program Files"/*; do
        if [[ -d "$broker_path" ]]; then
            if [[ "$broker_path" =~ [Mm]eta[Tt]rader|MT[45]|ICMarkets|Infinox|Pepperstone|XM|FBS|Exness ]]; then
                search_paths+=("$broker_path")
            fi
        fi
    done

    if [[ -n "$MT_PATH" ]]; then
        # Usar ruta especificada
        search_paths=("$MT_PATH")
    fi

    for path in "${search_paths[@]}"; do
        if [[ -d "$path" ]]; then
            # Detectar MT5
            if [[ -f "$path/terminal64.exe" ]]; then
                MT_PATH="$path"
                PLATFORM="mt5"
                print_success "MT5 detectado: $MT_PATH"
                return 0
            fi

            # Detectar MT4
            if [[ -f "$path/terminal.exe" ]]; then
                MT_PATH="$path"
                PLATFORM="mt4"
                print_success "MT4 detectado: $MT_PATH"
                return 0
            fi
        fi
    done

    print_error "No se detecto MetaTrader"
    print_info ""
    print_info "Opciones:"
    print_info "  1. Instala MT4 o MT5 via Wine"
    print_info "  2. Especifica la ruta con --mt-path"
    print_info "     Ejemplo: $0 --api-key 'xxx' --mt-path ~/.wine/drive_c/Program\ Files/MetaTrader\ 5"
    exit 1
}

# ============================================
# VERIFICAR WINE
# ============================================

check_wine() {
    if ! command -v wine &> /dev/null; then
        print_error "Wine no esta instalado"
        print_info ""
        print_info "Instala Wine primero:"
        print_info "  Ubuntu/Debian: sudo apt install wine64"
        print_info "  CentOS/RHEL:   sudo yum install wine"
        exit 1
    fi

    print_success "Wine instalado: $(wine --version)"
}

# ============================================
# DESCARGAR EA
# ============================================

download_ea() {
    print_header "Descargando EA"

    local ea_file="TBSSignalEA"
    if [[ "$PLATFORM" == "mt4" ]]; then
        ea_file="${ea_file}.ex4"
    else
        ea_file="${ea_file}.ex5"
    fi

    local download_url="${SAAS_URL}/api/bot/ea/${PLATFORM}"
    local temp_dir=$(mktemp -d)
    EA_TEMP_PATH="${temp_dir}/${ea_file}"

    print_info "Descargando $ea_file desde $download_url..."

    # Descargar con autenticacion
    local http_code=$(curl -s -o "$EA_TEMP_PATH" -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "User-Agent: TBS-Installer/$VERSION" \
        "$download_url")

    if [[ "$http_code" == "401" ]]; then
        print_error "API key invalida o expirada"
        rm -rf "$temp_dir"
        exit 1
    elif [[ "$http_code" == "403" ]]; then
        print_error "Acceso denegado. Verifica tu suscripcion."
        rm -rf "$temp_dir"
        exit 1
    elif [[ "$http_code" == "404" ]]; then
        print_error "EA no encontrado en el servidor"
        rm -rf "$temp_dir"
        exit 1
    elif [[ "$http_code" != "200" ]]; then
        print_error "Error descargando EA (HTTP $http_code)"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Verificar tamano del archivo
    local file_size=$(stat -f%z "$EA_TEMP_PATH" 2>/dev/null || stat -c%s "$EA_TEMP_PATH" 2>/dev/null || echo "0")
    if [[ "$file_size" -lt 1000 ]]; then
        print_error "El archivo es demasiado pequeno ($file_size bytes)"
        rm -rf "$temp_dir"
        exit 1
    fi

    print_success "EA descargado: $ea_file ($file_size bytes)"
}

# ============================================
# INSTALAR EA
# ============================================

install_ea() {
    print_header "Instalando EA"

    local mql_dir="MQL5"
    if [[ "$PLATFORM" == "mt4" ]]; then
        mql_dir="MQL4"
    fi

    local experts_path="${MT_PATH}/${mql_dir}/Experts"

    # Crear directorio si no existe
    if [[ ! -d "$experts_path" ]]; then
        mkdir -p "$experts_path"
        print_success "Creado: $experts_path"
    else
        print_info "Existe: $experts_path"
    fi

    # Backup del EA anterior
    local ea_file=$(basename "$EA_TEMP_PATH")
    local ea_final_path="${experts_path}/${ea_file}"

    if [[ -f "$ea_final_path" ]]; then
        mv "$ea_final_path" "${ea_final_path}.bak"
        print_info "Backup creado: ${ea_file}.bak"
    fi

    # Copiar EA
    cp "$EA_TEMP_PATH" "$ea_final_path"
    print_success "EA instalado: $ea_final_path"

    # Crear archivo de instrucciones
    local readme_path="${experts_path}/TBS_README.txt"
    cat > "$readme_path" << EOF
//+------------------------------------------------------------------+
//| Configuracion del EA TBS                                         |
//+------------------------------------------------------------------+
//
// IMPORTANTE: La API key ya esta configurada.
//
// Configuracion:
//   API Key: ${API_KEY:0:10}...
//   Server: $SAAS_URL
//   Symbol: XAUUSD
//   Lot: 0.01
//   Magic: 20260101
//
EOF
    print_success "README creado: $readme_path"

    # Limpiar temporal
    rm -rf "$(dirname "$EA_TEMP_PATH")"
}

# ============================================
# CONFIGURAR WEBREQUEST
# ============================================

configure_webrequest() {
    print_header "Configuracion de WebRequest"

    local mql_dir="MQL5"
    if [[ "$PLATFORM" == "mt4" ]]; then
        mql_dir="MQL4"
    fi

    print_info "Configuracion necesaria en $PLATFORM:"
    print_info "  1. Abre $PLATFORM"
    print_info "  2. Ve a Herramientas > Opciones > Asesores Expertos"
    print_info "  3. Activa 'Permitir solicitudes Web'"
    print_info "  4. Anade: $SAAS_URL"
}

# ============================================
# RESUMEN FINAL
# ============================================

show_summary() {
    print_header "Instalacion completada!"

    local terminal_exe="terminal64.exe"
    if [[ "$PLATFORM" == "mt4" ]]; then
        terminal_exe="terminal.exe"
    fi

    echo ""
    echo -e "  ${GREEN}El EA ha sido instalado correctamente.${NC}"
    echo ""
    echo -e "  ${YELLOW}PROXIMOS PASOS:${NC}"
    echo ""
    echo -e "  1. Inicia $PLATFORM:"
    echo -e "     ${WHITE}wine \"${MT_PATH}/${terminal_exe}\"${NC}"
    echo ""
    echo -e "  2. Configura WebRequest (SOLO LA PRIMERA VEZ):"
    echo -e "     ${WHITE}- Herramientas > Opciones > Asesores Expertos${NC}"
    echo -e "     ${WHITE}- Activa 'Permitir solicitudes Web'${NC}"
    echo -e "     ${WHITE}- Anade: $SAAS_URL${NC}"
    echo ""
    echo -e "  3. Carga el EA:"
    echo -e "     ${WHITE}- Abre el grafico XAUUSD${NC}"
    echo -e "     ${WHITE}- Arrastra 'TBSSignalEA' al grafico${NC}"
    echo ""
    echo -e "  4. Configura la API key:"
    echo -e "     ${CYAN}ApiKey = $API_KEY${NC}"
    echo ""
    echo -e "  ${YELLOW}ARCHIVOS INSTALADOS:${NC}"
    echo -e "  ${WHITE}- EA: ${MT_PATH}/MQL${PLATFORM:2}/Experts/TBSSignalEA.ex${PLATFORM:2:1}${NC}"
    echo ""

    # Iniciar terminal si se solicita
    if [[ "$START_TERMINAL" == "true" ]]; then
        print_info "Iniciando terminal..."
        wine "${MT_PATH}/${terminal_exe}" &
        print_success "Terminal iniciado"
    fi

    echo ""
    echo -e "  ${BLUE}=========================================${NC}"
    echo -e "  ${BLUE}|  Soporte: https://refocus.agency       |${NC}"
    echo -e "  ${BLUE}=========================================${NC}"
    echo ""
}

# ============================================
# MAIN
# ============================================

main() {
    show_banner
    parse_args "$@"

    # Verificar que se ejecuta como root o con sudo no es necesario
    # pero informamos si hay permisos
    if [[ $EUID -eq 0 ]]; then
        print_info "Ejecutando como root"
    fi

    print_info "API Key: ${API_KEY:0:10}..."
    print_info "SaaS URL: $SAAS_URL"
    print_info "Plataforma: $PLATFORM"

    # Verificar Wine
    check_wine

    # Detectar MT4/MT5
    find_mt_installation

    # Descargar EA
    download_ea

    # Instalar EA
    install_ea

    # Configurar WebRequest
    configure_webrequest

    # Mostrar resumen
    show_summary
}

main "$@"

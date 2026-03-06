//+------------------------------------------------------------------+
//|                                               TBSSignalEA.mq4   |
//|                              Trading Bot SaaS — Refocus Agency  |
//|                                        https://refocus.agency    |
//+------------------------------------------------------------------+
//
// INSTALACIÓN:
//  1. Copia este archivo en: MetaTrader4/MQL4/Experts/TBSSignalEA.mq4
//  2. Compila con MetaEditor (F7)
//  3. Arrastra el EA al gráfico XAUUSD (cualquier timeframe)
//  4. En MT4: Herramientas > Opciones > Asesores Expertos
//     → Activar "Permitir solicitudes Web para URL listadas"
//     → Añadir: https://trading-bot-saas.vercel.app
//  5. Introduce tu ApiKey del dashboard TBS
//
// SEGURIDAD:
//  - El EA envía tu número de cuenta MT4 en cada request
//  - Si la cuenta no coincide con tu suscripción → sin señales
//  - El EA es inútil sin credenciales válidas en el servidor
//
//+------------------------------------------------------------------+

#property copyright "Refocus Agency"
#property link      "https://refocus.agency"
#property version   "1.00"
#property strict

//--- Inputs
input string ApiKey      = "";                                          // API Key (del dashboard TBS)
input string ServerUrl   = "https://trading-bot-saas.vercel.app";      // URL del servidor
input string EASymbol    = "XAUUSD";                                   // Símbolo a operar
input double LotSize     = 0.01;                                        // Tamaño de lote
input int    Slippage    = 3;                                           // Slippage máximo (pips)
input int    MagicNumber = 20260101;                                    // Magic number único
input int    PollSeconds = 2;                                           // Intervalo de consulta (segundos)

//--- Globales
datetime g_lastPollTime  = 0;
string   g_lastSignalId  = "";

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   if(ApiKey == "")
   {
      Alert("TBS EA: ApiKey no configurada. Introduce tu API key del dashboard TBS.");
      return(INIT_PARAMETERS_INCORRECT);
   }

   Print("TBS EA iniciado | Cuenta: ", AccountNumber(), " | Servidor: ", ServerUrl);
   Print("TBS EA | Symbol: ", EASymbol, " | Lot: ", LotSize, " | Magic: ", MagicNumber);

   // Test de conectividad inicial
   if(!TestConnection())
   {
      Alert("TBS EA: No se puede conectar al servidor. Verifica la URL y que WebRequest esté habilitado.");
      return(INIT_FAILED);
   }

   Print("TBS EA | Conexión OK. Esperando señales...");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("TBS EA desconectado. Razón: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
   // Polling cada N segundos
   if(TimeCurrent() - g_lastPollTime < PollSeconds)
      return;

   g_lastPollTime = TimeCurrent();
   PollSignals();
}

//+------------------------------------------------------------------+
//| Test de conectividad                                              |
//+------------------------------------------------------------------+
bool TestConnection()
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;
   int res = WebRequest("GET", ServerUrl + "/api/health", headers, 5000, data, result, resultHeaders);
   return(res == 200);
}

//+------------------------------------------------------------------+
//| Construye los headers de autenticación                            |
//+------------------------------------------------------------------+
string BuildHeaders()
{
   string headers = "Authorization: Bearer " + ApiKey + "\r\n";
   headers       += "X-MT-Account: " + IntegerToString(AccountNumber()) + "\r\n";
   headers       += "X-Platform: MT4\r\n";
   headers       += "Content-Type: application/json\r\n";
   return(headers);
}

//+------------------------------------------------------------------+
//| Consulta señales pendientes al servidor                           |
//+------------------------------------------------------------------+
void PollSignals()
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   int res = WebRequest(
      "GET",
      ServerUrl + "/api/bot/signals/pending",
      headers,
      5000,
      data,
      result,
      resultHeaders
   );

   if(res == 401)
   {
      Print("TBS EA | Error 401: API key inválida o expirada. Verifica tu suscripción en el dashboard.");
      return;
   }

   if(res == 403)
   {
      Print("TBS EA | Error 403: Cuenta MT4 no autorizada. Esta cuenta no está registrada en tu suscripción TBS.");
      return;
   }

   if(res == 429)
   {
      Print("TBS EA | Rate limit alcanzado. Esperando...");
      return;
   }

   if(res != 200)
   {
      Print("TBS EA | Error HTTP: ", res);
      return;
   }

   // Parsear JSON
   string json = CharArrayToString(result);
   if(StringFind(json, "\"signals\"") < 0)
      return;

   // Extraer count
   int count = ParseIntField(json, "count");
   if(count <= 0)
      return;

   Print("TBS EA | ", count, " señal(es) pendiente(s)");
   ProcessSignalsJson(json);
}

//+------------------------------------------------------------------+
//| Procesa el JSON de señales                                        |
//+------------------------------------------------------------------+
void ProcessSignalsJson(string json)
{
   // Iterar sobre señales en el array (parseado manualmente)
   int pos = 0;
   while(true)
   {
      int start = StringFind(json, "{\"id\":", pos);
      if(start < 0) break;

      int end = StringFind(json, "}", start);
      if(end < 0) break;

      // Buscar el cierre del objeto completo (puede tener objetos anidados)
      end = FindObjectEnd(json, start);
      if(end < 0) break;

      string signalObj = StringSubstr(json, start, end - start + 1);
      ProcessSingleSignal(signalObj);

      pos = end + 1;
   }
}

//+------------------------------------------------------------------+
//| Encuentra el cierre de un objeto JSON                             |
//+------------------------------------------------------------------+
int FindObjectEnd(string json, int start)
{
   int depth = 0;
   int len = StringLen(json);
   for(int i = start; i < len; i++)
   {
      ushort c = StringGetCharacter(json, i);
      if(c == '{') depth++;
      else if(c == '}') { depth--; if(depth == 0) return(i); }
   }
   return(-1);
}

//+------------------------------------------------------------------+
//| Procesa una señal individual                                      |
//+------------------------------------------------------------------+
void ProcessSingleSignal(string signalObj)
{
   string signalId   = ParseStringField(signalObj, "id");
   string signalType = ParseStringField(signalObj, "type");  // "ENTRY" o "CLOSE"
   string side       = ParseStringField(signalObj, "side");  // "BUY" o "SELL"
   double price      = ParseDoubleField(signalObj, "price");
   string symbol     = ParseStringField(signalObj, "symbol");

   if(signalId == "" || signalType == "")
   {
      Print("TBS EA | Señal malformada: ", signalObj);
      return;
   }

   // Evitar procesar la misma señal dos veces
   if(signalId == g_lastSignalId)
      return;

   Print("TBS EA | Procesando señal ", signalId, " | Tipo: ", signalType, " | Side: ", side);

   bool success = false;

   if(signalType == "ENTRY")
      success = ExecuteEntry(side, price, symbol);
   else if(signalType == "CLOSE")
      success = ExecuteClose(symbol);

   if(success)
   {
      g_lastSignalId = signalId;
      AckSignal(signalId);
   }
}

//+------------------------------------------------------------------+
//| Ejecuta una orden de entrada                                      |
//+------------------------------------------------------------------+
bool ExecuteEntry(string side, double price, string symbol)
{
   int orderType = (side == "BUY") ? OP_BUY : OP_SELL;
   double orderPrice = (orderType == OP_BUY) ? Ask : Bid;

   // Si se especificó precio, usarlo como referencia pero ejecutar a mercado
   // (para evitar requotes en XAUUSD)
   int ticket = OrderSend(
      symbol == "" ? EASymbol : symbol,
      orderType,
      LotSize,
      orderPrice,
      Slippage,
      0,        // SL: sin SL automático (lo gestiona el bot)
      0,        // TP: sin TP automático
      "TBS Signal",
      MagicNumber,
      0,
      orderType == OP_BUY ? clrGreen : clrRed
   );

   if(ticket < 0)
   {
      Print("TBS EA | Error al abrir orden: ", GetLastError(), " | Side: ", side);
      return(false);
   }

   Print("TBS EA | Orden abierta OK | Ticket: ", ticket, " | ", side, " @ ", orderPrice);
   return(true);
}

//+------------------------------------------------------------------+
//| Cierra todas las posiciones del EA en el símbolo                  |
//+------------------------------------------------------------------+
bool ExecuteClose(string symbol)
{
   string sym = (symbol == "") ? EASymbol : symbol;
   bool closed = false;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderSymbol() != sym || OrderMagicNumber() != MagicNumber) continue;

      double closePrice = (OrderType() == OP_BUY) ? Bid : Ask;
      bool result = OrderClose(OrderTicket(), OrderLots(), closePrice, Slippage, clrYellow);

      if(result)
      {
         Print("TBS EA | Orden cerrada OK | Ticket: ", OrderTicket());
         closed = true;
      }
      else
      {
         Print("TBS EA | Error al cerrar orden ", OrderTicket(), ": ", GetLastError());
      }
   }

   return(closed);
}

//+------------------------------------------------------------------+
//| Confirma señal procesada al servidor                              |
//+------------------------------------------------------------------+
void AckSignal(string signalId)
{
   string headers = BuildHeaders();
   char   data[], result[];
   string resultHeaders;

   int res = WebRequest(
      "GET",
      ServerUrl + "/api/bot/signals/" + signalId + "/ack",
      headers,
      5000,
      data,
      result,
      resultHeaders
   );

   if(res == 200)
      Print("TBS EA | Señal ", signalId, " confirmada OK");
   else
      Print("TBS EA | Error confirmando señal ", signalId, ": HTTP ", res);
}

//+------------------------------------------------------------------+
//| Helpers de parsing JSON (sin librerías externas)                  |
//+------------------------------------------------------------------+
string ParseStringField(string json, string field)
{
   string search = "\"" + field + "\":\"";
   int start = StringFind(json, search);
   if(start < 0) return("");
   start += StringLen(search);
   int end = StringFind(json, "\"", start);
   if(end < 0) return("");
   return(StringSubstr(json, start, end - start));
}

double ParseDoubleField(string json, string field)
{
   string search = "\"" + field + "\":";
   int start = StringFind(json, search);
   if(start < 0) return(0.0);
   start += StringLen(search);
   int end = start;
   int len = StringLen(json);
   while(end < len)
   {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}' || c == ']') break;
      end++;
   }
   string val = StringSubstr(json, start, end - start);
   return(StringToDouble(val));
}

int ParseIntField(string json, string field)
{
   return((int)ParseDoubleField(json, field));
}
//+------------------------------------------------------------------+

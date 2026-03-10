import { useState, useRef, useEffect } from "react";

const buildSystemPrompt = (tcOficial, tcBlue) => `Sos un asesor experto en importación en Argentina. Tu rol es guiar al usuario paso a paso para calcular el costo total de importar un producto.

TIPO DE CAMBIO ACTUALIZADO (obtenido automáticamente ahora mismo):
- Dólar Oficial BNA: $${tcOficial ? tcOficial.toLocaleString("es-AR") : "consultar"} ARS
- Dólar Blue: $${tcBlue ? tcBlue.toLocaleString("es-AR") : "consultar"} ARS
Usá SIEMPRE el dólar oficial BNA para los cálculos de aduana formal. NO le preguntes al usuario el tipo de cambio, ya lo tenés actualizado.

FLUJO DE CONVERSACIÓN:
1. Preguntá el nombre/descripción del producto
2. Preguntá el precio del producto en dólares (FOB)
3. Preguntá el costo de flete y seguro internacional (CIF). Si no lo sabe, estimá un 10-15% del FOB.
4. Preguntá si importa por COURIER (paquete personal, hasta USD 1000 libre de arancel con algunas condiciones) o por ADUANA FORMAL (régimen general)
5. Según la modalidad, calculá los impuestos correspondientes usando el tipo de cambio oficial ya provisto:
   - COURIER (hasta USD 200 sin impuestos, de USD 200 a USD 1000 paga 50% de arancel sobre el excedente, más IVA)
   - ADUANA FORMAL: Derecho de importación (varía por posición arancelaria, usá 20% como promedio si no se sabe), IVA (21%), IVA adicional (10.5%), Ganancias anticipadas (6%), Ingresos Brutos (3%). Base imponible = CIF * tipo de cambio oficial.
6. Preguntá el margen de ganancia deseado (%)
7. Presentá un resumen detallado con todos los costos desglosados en ARS y USD, y el precio de venta sugerido. Mencioná el tipo de cambio oficial que usaste.

REGLAS:
- Sé claro, directo y profesional. 
- Usá números concretos siempre.
- Si el usuario no sabe algo, dá valores estimados estándar y explicá.
- Hacé UNA sola pregunta por mensaje.
- Al final, mostrá el resumen con emojis y estructura clara.
- Recordá que en Argentina las regulaciones cambian seguido, siempre aclará que los valores son orientativos.
- Respondé siempre en español rioplatense.`;

const buildWelcomeMessage = (tcOficial) => ({
  role: "assistant",
  content: `¡Hola! 👋 Soy tu asesor de importación. Voy a ayudarte a calcular el costo real de traer un producto a Argentina, incluyendo aranceles, impuestos y tu margen de ganancia.\n\n📌 Ya tengo el tipo de cambio oficial actualizado: **$${tcOficial ? tcOficial.toLocaleString("es-AR") : "cargando..."} ARS**\n\n¿Qué producto querés importar?`
});

export default function ImportCalculator() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tcOficial, setTcOficial] = useState(null);
  const [tcBlue, setTcBlue] = useState(null);
  const [tcLoading, setTcLoading] = useState(true);
  const [tcError, setTcError] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch tipo de cambio al montar
  useEffect(() => {
    const fetchTC = async () => {
      try {
        const [resOficial, resBlue] = await Promise.all([
          fetch("https://dolarapi.com/v1/dolares/oficial"),
          fetch("https://dolarapi.com/v1/dolares/blue")
        ]);
        const oficial = await resOficial.json();
        const blue = await resBlue.json();
        const venta = oficial.venta;
        const ventaBlue = blue.venta;
        setTcOficial(venta);
        setTcBlue(ventaBlue);
        setMessages([buildWelcomeMessage(venta)]);
      } catch (e) {
        setTcError(true);
        setMessages([buildWelcomeMessage(null)]);
      } finally {
        setTcLoading(false);
      }
    };
    fetchTC();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(tcOficial, tcBlue),
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      const assistantText = data.content?.map(b => b.text || "").join("") || "Error al obtener respuesta.";
      setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Hubo un error de conexión. Intentá de nuevo." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([buildWelcomeMessage(tcOficial)]);
    setInput("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b35 50%, #0a1628 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      padding: "20px"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }

        .chat-container {
          width: 100%;
          max-width: 720px;
          height: 85vh;
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          overflow: hidden;
          backdrop-filter: blur(20px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset;
        }

        .header {
          padding: 20px 28px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, #1a6cf0, #0a3d8f);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 16px rgba(26, 108, 240, 0.3);
        }

        .header-title {
          font-family: 'Syne', sans-serif;
          font-size: 17px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.3px;
        }

        .header-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          font-weight: 400;
          margin-top: 2px;
        }

        .reset-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .reset-btn:hover {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.8);
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .msg {
          display: flex;
          gap: 12px;
          animation: fadeUp 0.3s ease;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .msg.user { flex-direction: row-reverse; }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .avatar.ai {
          background: linear-gradient(135deg, #1a6cf0, #0a3d8f);
          box-shadow: 0 2px 8px rgba(26,108,240,0.25);
        }

        .avatar.user-av {
          background: linear-gradient(135deg, #1e3a5f, #0f2240);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .bubble {
          max-width: 80%;
          padding: 13px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.65;
          color: rgba(255,255,255,0.88);
          white-space: pre-wrap;
        }

        .bubble.ai {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          border-top-left-radius: 4px;
        }

        .bubble.user {
          background: linear-gradient(135deg, #1a6cf0, #1558cc);
          border-top-right-radius: 4px;
          box-shadow: 0 4px 16px rgba(26,108,240,0.2);
        }

        .typing {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          border-top-left-radius: 4px;
          width: fit-content;
        }

        .dot {
          width: 6px;
          height: 6px;
          background: rgba(255,255,255,0.4);
          border-radius: 50%;
          animation: pulse 1.4s infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .input-area {
          padding: 16px 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }

        .input-wrap {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          display: flex;
          align-items: center;
          transition: border-color 0.2s;
        }
        .input-wrap:focus-within {
          border-color: rgba(26,108,240,0.5);
        }

        textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          padding: 12px 16px;
          resize: none;
          max-height: 120px;
          min-height: 44px;
          line-height: 1.5;
        }
        textarea::placeholder { color: rgba(255,255,255,0.25); }

        .send-btn {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #1a6cf0, #1558cc);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(26,108,240,0.3);
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(26,108,240,0.4);
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .badge {
          display: inline-block;
          background: rgba(26,108,240,0.15);
          border: 1px solid rgba(26,108,240,0.25);
          color: #5a9ff5;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-left: 8px;
        }
      `}</style>

      <div className="chat-container">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <div className="logo">📦</div>
            <div>
              <div className="header-title">
                ImportAR
                <span className="badge">IA</span>
              </div>
              <div className="header-sub">Calculadora de costos de importación · Argentina</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {tcLoading ? (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Cargando cotización...</span>
            ) : tcError ? (
              <span style={{ fontSize: 11, color: "#f87171" }}>⚠ Sin cotización</span>
            ) : (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 1 }}>Tipo de cambio</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
                    Oficial ${tcOficial?.toLocaleString("es-AR")}
                  </span>
                  <span style={{ fontSize: 12, color: "#fb923c", fontWeight: 600 }}>
                    Blue ${tcBlue?.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            )}
            <button className="reset-btn" onClick={resetChat}>Nueva consulta</button>
          </div>
        </div>

        {/* Messages */}
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role === "user" ? "user" : ""}`}>
              <div className={`avatar ${msg.role === "user" ? "user-av" : "ai"}`}>
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div className={`bubble ${msg.role === "user" ? "user" : "ai"}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg">
              <div className="avatar ai">🤖</div>
              <div className="typing">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrap">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Escribí tu respuesta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

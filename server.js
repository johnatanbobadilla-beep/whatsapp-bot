const express = require("express");
const app = express();
app.use(express.json());

// ==============================
// CONFIGURACION - Estos valores vienen de "Environment Variables" en Render
// (NO los escribas aqui directamente, los configuramos en el panel de Render)
// ==============================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT =
  "Eres un asistente virtual amigable de Tu Pagina Group, una agencia de desarrollo web y marketing digital. Responde de forma breve, clara y profesional en espanol. Si preguntan por servicios, menciona: desarrollo web WordPress, SEO, Meta Ads y Google Ads.";

// ==============================
// PASO 1: VERIFICACION DEL WEBHOOK (Meta hace esta llamada GET)
// ==============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Token incorrecto");
});

// ==============================
// PASO 2: RECIBIR MENSAJE ENTRANTE (Meta hace esta llamada POST)
// ==============================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      if (from && text) {
        const respuestaIA = await preguntarGemini(text);
        await enviarWhatsApp(from, respuestaIA);
      }
    }
  } catch (err) {
    console.error("Error procesando webhook:", err);
  }

  res.status(200).send("EVENTO RECIBIDO");
});

// Ruta simple para confirmar que el servidor esta vivo
app.get("/", (req, res) => {
  res.send("Webhook funcionando");
});

// ==============================
// FUNCIONES
// ==============================

async function preguntarGemini(mensajeUsuario) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: mensajeUsuario }] }],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  console.log("Respuesta Gemini:", JSON.stringify(json));

  const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return texto || "Disculpa, tuve un problema procesando tu mensaje. Puedes intentar de nuevo?";
}

async function enviarWhatsApp(to, mensaje) {
  const url = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: mensaje },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  console.log("Respuesta envio WhatsApp:", JSON.stringify(json));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

// src/services/webhook.service.ts
import axios from "axios";

// Função para registrar webhook na Evolution API
export async function registerWebhook(
  instanceName: string,
  webhookUrl: string
) {
  try {
    const evolutionApiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    await axios.post(
      `${evolutionApiUrl}/webhook/set/${instanceName}`,
      {
        url: webhookUrl,
        events: ["messages.upsert", "messages.update", "status.instance"],
      },
      {
        headers: { apikey: apiKey },
      }
    );

    console.log("Webhook registrado com sucesso");
    return true;
  } catch (error) {
    console.error("Erro ao registrar webhook:", error);
    return false;
  }
}

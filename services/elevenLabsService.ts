
import { ElevenLabsVoice, ElevenLabsModel } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const API_BASE = "https://api.elevenlabs.io/v1";

export async function fetchElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  const response = await fetch(`${API_BASE}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || "Failed to fetch voices");
  }

  const data = await response.json();
  return data.voices.map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    preview_url: v.preview_url
  }));
}

export async function fetchElevenLabsModels(apiKey: string): Promise<ElevenLabsModel[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  const response = await fetch(`${API_BASE}/models`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
     const error = await response.json();
    throw new Error(error.detail?.message || "Failed to fetch models");
  }

  const data = await response.json();
  
  // Filter for models that explicitly support text-to-speech
  const validModels = data.filter((m: any) => m.can_do_text_to_speech === true);

  return validModels.map((m: any) => ({
    model_id: m.model_id,
    name: m.name,
    description: m.description
  }));
}

export async function generateElevenLabsSpeechBytes(
  text: string,
  voiceId: string,
  modelId: string,
  apiKey: string,
  languageCode?: string // Added language code parameter
): Promise<Uint8Array> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");
  if (!text.trim()) return new Uint8Array(0);

  const body: any = {
    text,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  // Some newer models support/require language_code for better performance
  if (languageCode) {
    body.language_code = languageCode;
  }

  const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to generate speech";
    try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorMessage;
        
        // Custom check for the common error to give a better hint
        if (errorMessage.includes("selected model can not be used")) {
            errorMessage += " (Hãy thử chọn Model khác như 'Eleven Multilingual v2')";
        }
    } catch(e) {
        errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  // Convert MP3/Audio data to raw PCM for compatibility with our utils
  return await decodeAudioDataToPcm(arrayBuffer);
}

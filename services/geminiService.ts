
import { GoogleGenAI, Modality } from "@google/genai";
import { decode, createWavBlob } from "../utils/audioUtils";

export async function generateSpeech(text: string, voice: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error("API key is missing.");
  }
  // Initialize the AI client inside the function to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey });

  if (!text.trim()) {
    // Return a silent audio URL for empty strings to avoid API errors
    const silentBlob = createWavBlob(new Uint8Array(0));
    return URL.createObjectURL(silentBlob);
  }

  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("API did not return audio data.");
  }

  const audioBytes = decode(base64Audio);
  const wavBlob = createWavBlob(audioBytes);
  const audioUrl = URL.createObjectURL(wavBlob);
  
  return audioUrl;
}

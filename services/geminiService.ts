import { GoogleGenAI, Modality } from "@google/genai";
import { decode, createWavBlob } from "../utils/audioUtils";

/**
 * Generates audio bytes for the given text using the Gemini TTS model.
 * Always initializes with process.env.API_KEY as per the coding guidelines.
 */
export async function generateSpeechBytes(text: string, voice: string): Promise<Uint8Array> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  if (!text.trim()) {
    return new Uint8Array(0);
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

  return decode(base64Audio);
}

/**
 * Generates a WAV audio URL for the given text using the Gemini TTS model.
 */
export async function generateSpeech(text: string, voice: string): Promise<string> {
  const audioBytes = await generateSpeechBytes(text, voice);
  const wavBlob = createWavBlob(audioBytes);
  const audioUrl = URL.createObjectURL(wavBlob);
  return audioUrl;
}
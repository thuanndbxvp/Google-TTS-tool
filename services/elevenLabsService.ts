
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";

// Cache for Proxy
let currentProxy: string | null = null;
let proxyExpiry: number = 0; // Timestamp

export async function fetchElevenLabsVoices(apiKey: string, baseUrl: string = DEFAULT_API_BASE): Promise<ElevenLabsVoice[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  // Remove trailing slash if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  const response = await fetch(`${cleanBaseUrl}/voices`, {
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

export async function fetchElevenLabsModels(apiKey: string, baseUrl: string = DEFAULT_API_BASE): Promise<ElevenLabsModel[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  const response = await fetch(`${cleanBaseUrl}/models`, {
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

/**
 * Lấy Proxy từ proxyxoay.shop
 */
async function getProxyXoay(keyXoay: string): Promise<string> {
    const now = Date.now();
    
    // Nếu đã có proxy và chưa hết hạn, dùng lại (trừ đi 30s để an toàn)
    if (currentProxy && now < proxyExpiry - 30000) {
        console.log("Using Cached Proxy:", currentProxy);
        return currentProxy;
    }

    try {
        console.log("Fetching new proxy from proxyxoay.shop...");
        const url = `https://proxyxoay.shop/api/get.php?key=${keyXoay}&nhamang=Random&tinhthanh=0`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 100 && data.proxyhttp) {
            currentProxy = data.proxyhttp;
            // Parse token expiration date: "22:52 19-02-2025"
            // Định dạng trả về có vẻ là HH:mm dd-MM-yyyy. Cần parse thủ công vì Date.parse không chuẩn với định dạng này
            const dateStr = data["Token expiration date"]; // "22:52 19-02-2025"
            if (dateStr) {
                const parts = dateStr.split(" ");
                const timeParts = parts[0].split(":");
                const dateParts = parts[1].split("-");
                // new Date(year, monthIndex, day, hours, minutes)
                const expiryDate = new Date(
                    parseInt(dateParts[2]), 
                    parseInt(dateParts[1]) - 1, 
                    parseInt(dateParts[0]), 
                    parseInt(timeParts[0]), 
                    parseInt(timeParts[1])
                );
                proxyExpiry = expiryDate.getTime();
            } else {
                // Fallback: 10 phút
                proxyExpiry = now + 10 * 60 * 1000;
            }
            console.log("New Proxy Acquired:", currentProxy, "Expires:", new Date(proxyExpiry).toLocaleString());
            return currentProxy;
        } else {
            console.error("ProxyXoay Error:", data);
            throw new Error(data.message || "Failed to get proxy from proxyxoay");
        }
    } catch (e: any) {
        // Nếu fetch lỗi, xóa cache
        currentProxy = null;
        throw new Error(`Lỗi lấy Proxy: ${e.message}`);
    }
}

export async function generateElevenLabsSpeechBytes(
  text: string,
  voiceId: string,
  modelId: string,
  apiKey: string,
  languageCode?: string,
  baseUrl: string = DEFAULT_API_BASE,
  settings?: ElevenLabsSettings,
  speed: number = 1.0,
  proxyKey?: string // Thêm tham số proxyKey
): Promise<Uint8Array> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");
  if (!text.trim()) return new Uint8Array(0);

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  // Logic xử lý Proxy
  let proxyUrl = "";
  if (proxyKey) {
      try {
          proxyUrl = await getProxyXoay(proxyKey);
      } catch (e: any) {
          // Nếu lấy proxy lỗi, có thể chọn ném lỗi hoặc tiếp tục chạy bằng IP thật.
          // Ở đây chọn cách throw lỗi để người dùng biết config sai.
          throw new Error(`Proxy Error: ${e.message}`);
      }
  }

  // Default settings if not provided
  const voiceSettings = {
    stability: settings?.stability ?? 0.5,
    similarity_boost: settings?.similarityBoost ?? 0.75,
    style: settings?.style ?? 0.0,
    use_speaker_boost: settings?.useSpeakerBoost ?? true
  };

  const body: any = {
    text,
    model_id: modelId,
    voice_settings: voiceSettings,
  };

  // Some newer models support/require language_code for better performance
  if (languageCode) {
    body.language_code = languageCode;
  }

  // Chuẩn bị headers
  const headers: any = {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
  };

  // Nếu có proxy, thêm vào header để hỗ trợ các tool bắt/redirect request (hoặc nếu người dùng dùng Custom Base URL là 1 Proxy Gateway)
  if (proxyUrl) {
      // Lưu ý: Trình duyệt mặc định KHÔNG hỗ trợ set proxy cho fetch API trực tiếp.
      // Dòng này chỉ có tác dụng nếu user dùng Custom Base URL đóng vai trò là Forwarder,
      // hoặc sử dụng Extension hỗ trợ bắt header này để route.
      headers["X-Proxy-Url"] = proxyUrl;
      headers["X-Forwarded-For"] = proxyUrl.split(":")[0]; 
      console.log(`Requesting ElevenLabs via Proxy Configuration: ${proxyUrl}`);
  }

  const response = await fetch(`${cleanBaseUrl}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: headers,
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
        
        // Custom check for Voice Limit error
        if (errorMessage.includes("maximum amount of custom voices")) {
            errorMessage = "Lỗi ElevenLabs: Tài khoản này đã đạt giới hạn giọng tùy chỉnh (Custom Voices). Vui lòng xóa bớt giọng trong VoiceLab.";
        }

        // Custom check for Unusual Activity / Abuse detection
        if (errorMessage.includes("Unusual activity detected")) {
            let msg = "Lỗi ElevenLabs: Phát hiện bất thường (Unusual activity).";
            if (!proxyKey) {
                msg += " Bạn chưa bật Key Proxy Xoay. Hãy nhập Key Xoay trong cài đặt để đổi IP.";
            } else {
                msg += " IP Proxy hiện tại có thể đã bị chặn, thử chạy lại để lấy IP mới.";
                // Invalidate cache to force new proxy next time
                currentProxy = null;
            }
            errorMessage = msg;
        }
    } catch(e) {
        errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  // Convert MP3/Audio data to raw PCM for compatibility with our utils
  // Pass speed parameter to handle resampling if needed
  return await decodeAudioDataToPcm(arrayBuffer, speed);
}

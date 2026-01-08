
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";
const RELAY_URL = "https://gomhuongcanh.vn/ai_studio_code.php";

// Initialize Cache from LocalStorage if available
let currentProxy: string | null = localStorage.getItem('tts_cached_proxy');
let proxyExpiry: number = parseInt(localStorage.getItem('tts_proxy_expiry') || '0');

function saveProxyToCache(proxy: string, expiry: number) {
    currentProxy = proxy;
    proxyExpiry = expiry;
    localStorage.setItem('tts_cached_proxy', proxy);
    localStorage.setItem('tts_proxy_expiry', expiry.toString());
}

export async function fetchElevenLabsVoices(apiKey: string, baseUrl: string = DEFAULT_API_BASE): Promise<ElevenLabsVoice[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  let cleanBaseUrl = baseUrl.replace(/\/$/, "");

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

  let cleanBaseUrl = baseUrl.replace(/\/$/, "");

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
 * Xử lý dữ liệu trả về từ API ProxyXoay
 */
function handleProxyResponse(data: any): string {
    const rawMsg = data.msg || data.message || '';
    
    // Ưu tiên 1: Nếu server trả về proxyhttp, lấy luôn bất kể msg là gì
    // Vì đôi khi server báo "Chưa đến giờ đổi" nhưng vẫn trả về proxy cũ (hoặc proxy hiện tại)
    if (data.proxyhttp) {
        let newExpiry = Date.now() + 10 * 60 * 1000; // Mặc định 10p

        // Parse ngày hết hạn nếu có
        const dateStr = data["Token expiration date"]; 
        if (dateStr) {
            try {
                // Format thường gặp: "22:52 19-02-2025" (HH:mm dd-MM-yyyy)
                const parts = dateStr.split(" ");
                const timeParts = parts[0].split(":");
                const dateParts = parts[1].split("-");
                const expiryDate = new Date(
                    parseInt(dateParts[2]), 
                    parseInt(dateParts[1]) - 1, 
                    parseInt(dateParts[0]), 
                    parseInt(timeParts[0]), 
                    parseInt(timeParts[1])
                );
                newExpiry = expiryDate.getTime();
            } catch (e) {
                 // Ignore parse error
            }
        }
        
        saveProxyToCache(data.proxyhttp, newExpiry);
        console.log("Proxy Acquired (Refresh/New):", currentProxy);
        return currentProxy as string;
    }

    // Ưu tiên 2: Nếu không có proxyhttp mới, nhưng server báo Cooldown -> Dùng lại Cache cũ
    if (typeof rawMsg === 'string') {
        const waitMatch = rawMsg.match(/Con (\d+)s moi co the doi proxy/i);
        if (waitMatch) {
            if (currentProxy) {
                console.warn(`Proxy rotation cooldown (${waitMatch[1]}s). Reusing cached proxy from LocalStorage.`);
                // Update expiry ảo để tránh request lại ngay lập tức
                const newExpiry = Date.now() + (parseInt(waitMatch[1]) * 1000) + 5000; 
                saveProxyToCache(currentProxy, newExpiry);
                return currentProxy;
            }
            
            // Không có cache mà bị cooldown -> Lỗi
            const seconds = waitMatch[1];
            throw new Error(`Proxy chưa sẵn sàng đổi IP (cần đợi ${seconds}s) và không tìm thấy IP cũ.`);
        }
    }

    // API ProxyXoay trả về lỗi khác
    if (data.status && data.status !== 100) {
        throw new Error(`Lỗi ProxyXoay: ${rawMsg || 'Key không hợp lệ hoặc hết hạn'}`);
    }

    throw new Error(`Dữ liệu Proxy không hợp lệ: ${JSON.stringify(data)}`);
}

/**
 * Lấy Proxy từ proxyxoay.shop thông qua Relay Server
 */
async function getProxyXoay(keyXoay: string, isp: string = 'Random', locationId: string = '0'): Promise<string> {
    const now = Date.now();
    
    // Nếu đã có proxy và chưa hết hạn, dùng lại (trừ đi 10s để an toàn)
    if (currentProxy && now < proxyExpiry - 10000) {
        console.log("Using Cached Proxy (Valid):", currentProxy);
        return currentProxy;
    }

    // Gọi qua Relay Server
    const relayUrl = `${RELAY_URL}?action=get_proxy&key=${keyXoay}&nhamang=${encodeURIComponent(isp)}&tinhthanh=${locationId}&t=${now}`;
    
    try {
        console.log("Fetching proxy via Relay:", relayUrl);
        const res = await fetch(relayUrl);
        
        if (!res.ok) {
             throw new Error(`Lỗi HTTP ${res.status} từ Server Trung Gian.`);
        }

        const text = await res.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Relay returned non-JSON:", text);
            throw new Error(`Server trả về dữ liệu không hợp lệ: ${text.substring(0, 50)}...`);
        }

        return handleProxyResponse(data);

    } catch (e: any) {
        console.error("Proxy Fetch Error:", e);
        
        // Fallback: Nếu lỗi mạng/server nhưng vẫn còn proxy cũ trong storage -> Dùng tạm
        if (currentProxy) {
            console.warn("Error fetching new proxy, using cached proxy as fallback:", e.message);
            // Gia hạn tạm 30s để tránh spam lỗi
            saveProxyToCache(currentProxy, Date.now() + 30000);
            return currentProxy;
        }

        let msg = e.message;
        if (msg === 'Failed to fetch') {
            msg = 'Lỗi kết nối (CORS/Network). Vui lòng kiểm tra lại file PHP trên server gomhuongcanh.vn.';
        }
        throw new Error(`Lỗi lấy Proxy: ${msg}`);
    }
}

/**
 * Kiểm tra kết nối Proxy và trả về thông tin IP
 */
export async function verifyProxyConnection(proxyKey: string, apiKey: string, isp: string = 'Random', locationId: string = '0'): Promise<{ myIp: string, proxyIp: string, success: boolean, message: string }> {
    try {
        // 1. Lấy IP gốc
        let myIp = "Unknown";
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            myIp = ipData.ip;
        } catch (e) {
            console.warn("Could not fetch user IP", e);
        }

        // 2. Lấy Proxy String
        // Lưu ý: Nếu user muốn force check IP mới, ta có thể cần cơ chế force reset cache.
        // Tuy nhiên, với logic hiện tại, ta sẽ tôn trọng cache để tránh lỗi Cooldown.
        // Nếu muốn force, người dùng phải đợi hết hạn hoặc đổi Key.
        // Để "Kiểm tra IP" hiển thị đúng trạng thái hiện tại, ta chỉ gọi getProxyXoay.
        const proxyString = await getProxyXoay(proxyKey, isp, locationId);
        const proxyIp = proxyString.split(':')[0];

        // 3. Thử gọi đến 11Labs
        const response = await fetch(`${RELAY_URL}/models`, {
            method: 'GET',
            headers: {
                "xi-api-key": apiKey,
                "X-Proxy-Url": proxyString
            }
        });

        if (response.ok) {
            return {
                myIp,
                proxyIp,
                success: true,
                message: "Kết nối thành công!"
            };
        } else {
             const errText = await response.text();
             let msg = `Lỗi 11Labs: ${errText.substring(0, 100)}`;
             try {
                 const errJson = JSON.parse(errText);
                 if(errJson.detail && errJson.detail.message) msg = `Lỗi 11Labs: ${errJson.detail.message}`;
             } catch {}
             
             return {
                myIp,
                proxyIp,
                success: false,
                message: msg
            };
        }

    } catch (e: any) {
        return {
            myIp: "Unknown",
            proxyIp: "Error",
            success: false,
            message: `Lỗi: ${e.message}`
        };
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
  proxyKey?: string,
  proxyISP: string = 'Random',
  proxyLocation: string = '0'
): Promise<Uint8Array> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");
  if (!text.trim()) return new Uint8Array(0);

  let targetBaseUrl = proxyKey ? RELAY_URL : baseUrl;
  let cleanBaseUrl = targetBaseUrl.replace(/\/$/, "");

  let proxyUrl = "";
  if (proxyKey) {
      try {
          proxyUrl = await getProxyXoay(proxyKey, proxyISP, proxyLocation);
      } catch (e: any) {
          throw new Error(`Proxy Error: ${e.message}`);
      }
  }

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

  if (languageCode) {
    body.language_code = languageCode;
  }

  const headers: any = {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
  };

  if (proxyUrl) {
      headers["X-Proxy-Url"] = proxyUrl;
      console.log(`Requesting via Relay: ${cleanBaseUrl} with Proxy: ${proxyUrl.split(':')[0]}...`);
  }

  let response;
  try {
      response = await fetch(`${cleanBaseUrl}/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
      });
  } catch (e: any) {
      if (e.message === 'Failed to fetch') {
           throw new Error("Không thể kết nối tới Server Trung Gian. Vui lòng kiểm tra lại Proxy hoặc thử tắt Proxy nếu server hỗ trợ.");
      }
      throw e;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to generate speech";
    try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorMessage;
        
        if (errorMessage.includes("selected model can not be used")) {
            errorMessage += " (Hãy thử chọn Model khác như 'Eleven Multilingual v2')";
        }
        
        if (errorMessage.includes("maximum amount of custom voices")) {
            errorMessage = "Lỗi ElevenLabs: Tài khoản này đã đạt giới hạn giọng tùy chỉnh (Custom Voices). Vui lòng xóa bớt giọng trong VoiceLab.";
        }

        if (errorMessage.includes("Unusual activity detected")) {
            let msg = "Lỗi ElevenLabs: Phát hiện bất thường (Unusual activity).";
            if (!proxyKey) {
                msg += " Bạn chưa bật Key Proxy Xoay. Hãy nhập Key Xoay trong cài đặt để đổi IP.";
            } else {
                msg += " IP Proxy hiện tại có thể đã bị chặn, thử chạy lại để lấy IP mới.";
                // Invalidate cache if 11Labs blocks the current IP
                saveProxyToCache('', 0); 
            }
            errorMessage = msg;
        }
    } catch(e) {
        errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  return await decodeAudioDataToPcm(arrayBuffer, speed);
}

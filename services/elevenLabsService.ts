
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";
const RELAY_URL = "https://gomhuongcanh.vn/ai_studio_code.php";

// Cache for Proxy
let currentProxy: string | null = null;
let proxyExpiry: number = 0; // Timestamp

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
    // Kiểm tra thông báo lỗi cụ thể về thời gian chờ
    const rawMsg = data.msg || data.message || '';
    if (typeof rawMsg === 'string') {
        // Regex bắt chuỗi: "Con 49s moi co the doi proxy"
        const waitMatch = rawMsg.match(/Con (\d+)s moi co the doi proxy/i);
        if (waitMatch) {
            const seconds = waitMatch[1];
            throw new Error(`Proxy chưa sẵn sàng đổi IP. Vui lòng đợi ${seconds} giây nữa rồi thử lại.`);
        }
    }

    // API ProxyXoay thường trả về status: 100 nếu thành công
    // Nếu status != 100, tức là có lỗi (sai key, hết hạn, quá tần suất)
    if (data.status && data.status !== 100) {
        throw new Error(`Lỗi ProxyXoay: ${rawMsg || 'Key không hợp lệ hoặc hết hạn'}`);
    }

    if (data.proxyhttp) {
        currentProxy = data.proxyhttp;
        const now = Date.now();
        
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
                proxyExpiry = expiryDate.getTime();
            } catch (e) {
                 proxyExpiry = now + 10 * 60 * 1000; // Fallback 10p
            }
        } else {
            // Fallback: 10 phút
            proxyExpiry = now + 10 * 60 * 1000;
        }
        console.log("New Proxy Acquired:", currentProxy);
        return currentProxy as string;
    } else {
        // Trường hợp API trả về JSON nhưng không có proxyhttp (lỗi lạ)
        throw new Error(JSON.stringify(data));
    }
}

/**
 * Lấy Proxy từ proxyxoay.shop thông qua Relay Server
 * Tuyệt đối không gọi trực tiếp từ trình duyệt để tránh CORS
 */
async function getProxyXoay(keyXoay: string): Promise<string> {
    const now = Date.now();
    
    // Nếu đã có proxy và chưa hết hạn, dùng lại (trừ đi 30s để an toàn)
    if (currentProxy && now < proxyExpiry - 30000) {
        console.log("Using Cached Proxy:", currentProxy);
        return currentProxy;
    }

    // Gọi qua Relay Server
    // Thêm timestamp `t` để tránh browser cache response cũ
    const relayUrl = `${RELAY_URL}?action=get_proxy&key=${keyXoay}&t=${now}`;
    
    try {
        console.log("Fetching proxy via Relay:", relayUrl);
        // Đơn giản hóa request để tránh CORS Preflight (OPTIONS)
        const res = await fetch(relayUrl);
        
        if (!res.ok) {
             throw new Error(`Lỗi HTTP ${res.status} từ Server Trung Gian.`);
        }

        const text = await res.text();
        
        // Cố gắng parse JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            // Nếu server trả về HTML lỗi hoặc text thường
            console.error("Relay returned non-JSON:", text);
            throw new Error(`Server trả về dữ liệu không hợp lệ: ${text.substring(0, 50)}...`);
        }

        return handleProxyResponse(data);

    } catch (e: any) {
        console.error("Proxy Fetch Error:", e);
        // Reset cache nếu lỗi
        currentProxy = null;
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
export async function verifyProxyConnection(proxyKey: string, apiKey: string): Promise<{ myIp: string, proxyIp: string, success: boolean, message: string }> {
    try {
        // 1. Lấy IP gốc của người dùng
        let myIp = "Unknown";
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            myIp = ipData.ip;
        } catch (e) {
            console.warn("Could not fetch user IP", e);
        }

        // 2. Lấy Proxy String (để xem IP đại diện)
        // Hàm này giờ đã an toàn CORS nhờ qua Relay
        const proxyString = await getProxyXoay(proxyKey);
        // proxyString format: IP:PORT:USER:PASS hoặc IP:PORT
        const proxyIp = proxyString.split(':')[0];

        // 3. Thử gọi đến 11Labs thông qua Relay + Proxy để chắc chắn kết nối OK
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
                message: "Kết nối thành công tới ElevenLabs qua Proxy!"
            };
        } else {
             const errText = await response.text();
             let msg = `Lỗi kết nối 11Labs: ${errText.substring(0, 100)}`;
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
  baseUrl: string = DEFAULT_API_BASE, // Tham số này vẫn giữ để tương thích ngược, nhưng sẽ bị ghi đè nếu có proxyKey
  settings?: ElevenLabsSettings,
  speed: number = 1.0,
  proxyKey?: string 
): Promise<Uint8Array> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");
  if (!text.trim()) return new Uint8Array(0);

  // LOGIC QUAN TRỌNG:
  // Nếu có proxyKey -> BẮT BUỘC dùng Relay URL đã gắn cứng.
  // Nếu không có proxyKey -> Dùng baseUrl truyền vào (mặc định là api.elevenlabs.io)
  let targetBaseUrl = proxyKey ? RELAY_URL : baseUrl;
  let cleanBaseUrl = targetBaseUrl.replace(/\/$/, "");

  // Logic xử lý Proxy
  let proxyUrl = "";
  if (proxyKey) {
      try {
          proxyUrl = await getProxyXoay(proxyKey);
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
      // Gửi header cho Relay Script xử lý
      headers["X-Proxy-Url"] = proxyUrl;
      // Không gửi header X-Forwarded-For vì nó thường gây lỗi CORS Preflight hoặc bị chặn bởi WAF
      // headers["X-Forwarded-For"] = proxyUrl.split(":")[0]; 
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
      // Bắt lỗi Network error / CORS "Failed to fetch"
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
                currentProxy = null; // Reset cache
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

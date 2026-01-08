
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";
const RELAY_URL = "https://gomhuongcanh.vn/ai_studio_code.php";

// --- CACHE MANAGEMENT START ---

// Helper để tạo key cho LocalStorage dựa trên Proxy Key (lấy 8 ký tự đầu để định danh)
const getStorageKey = (proxyKey: string) => `tts_proxy_cache_${proxyKey.trim().substring(0, 15)}`;

interface ProxyCache {
    ip: string;
    expiry: number;
}

function getProxyFromCache(proxyKey: string): ProxyCache | null {
    try {
        const json = localStorage.getItem(getStorageKey(proxyKey));
        if (json) return JSON.parse(json);
    } catch (e) {
        console.error("Error reading proxy cache", e);
    }
    return null;
}

function saveProxyToCache(proxyKey: string, ip: string, expiry: number) {
    try {
        const data: ProxyCache = { ip, expiry };
        localStorage.setItem(getStorageKey(proxyKey), JSON.stringify(data));
        console.log(`[Cache Saved] Key: ...${proxyKey.substring(proxyKey.length-4)} | IP: ${ip} | Exp: ${new Date(expiry).toLocaleTimeString()}`);
    } catch (e) {
        console.error("Error saving proxy cache", e);
    }
}
// --- CACHE MANAGEMENT END ---

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
  const validModels = data.filter((m: any) => m.can_do_text_to_speech === true);

  return validModels.map((m: any) => ({
    model_id: m.model_id,
    name: m.name,
    description: m.description
  }));
}

/**
 * Xử lý phản hồi từ ProxyXoay
 */
function handleProxyResponse(data: any, proxyKey: string): string {
    const rawMsg = data.msg || data.message || '';
    
    // CASE 1: Thành công - Server trả về IP mới
    if (data.proxyhttp) {
        let newExpiry = Date.now() + 10 * 60 * 1000; // Mặc định 10 phút

        // Parse thời gian hết hạn từ server nếu có
        const dateStr = data["Token expiration date"]; 
        if (dateStr) {
            try {
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
            } catch (e) { }
        }
        
        saveProxyToCache(proxyKey, data.proxyhttp, newExpiry);
        return data.proxyhttp;
    }

    // CASE 2: Cooldown - Server bắt đợi
    if (typeof rawMsg === 'string') {
        const waitMatch = rawMsg.match(/Con (\d+)s moi co the doi proxy/i);
        if (waitMatch) {
            const seconds = parseInt(waitMatch[1]);
            
            // Cứu cánh: Kiểm tra xem có cache cũ không (bất kể hết hạn chưa)
            const cached = getProxyFromCache(proxyKey);
            if (cached && cached.ip) {
                console.warn(`[Proxy Cooldown] Wait ${seconds}s. REUSING cached IP: ${cached.ip}`);
                // Cập nhật lại expiry ảo để các request tiếp theo trong vài giây tới không spam server
                // Cộng thêm 5s vào thời gian chờ server báo
                const safeExpiry = Date.now() + (seconds * 1000) + 5000;
                saveProxyToCache(proxyKey, cached.ip, safeExpiry);
                return cached.ip;
            }
            
            // Nếu không có cache (Lần đầu nhập key đang bị cooldown) -> Bó tay
            throw new Error(`Proxy đang chờ đổi IP (${seconds}s). Do lần đầu sử dụng Key này trên thiết bị, bạn vui lòng đợi hết thời gian đếm ngược.`);
        }
    }

    // CASE 3: Lỗi khác
    if (data.status && data.status !== 100) {
        throw new Error(`Lỗi ProxyXoay: ${rawMsg || 'Key không hợp lệ hoặc hết hạn'}`);
    }

    throw new Error(`Dữ liệu Proxy không hợp lệ: ${JSON.stringify(data)}`);
}

/**
 * Lấy Proxy từ proxyxoay.shop thông qua Relay Server
 */
async function getProxyXoay(proxyKey: string, isp: string = 'Random', locationId: string = '0'): Promise<string> {
    const now = Date.now();
    const cached = getProxyFromCache(proxyKey);
    
    // 1. Kiểm tra Cache còn hạn không
    // Trừ hao 10s để đảm bảo an toàn
    if (cached && now < cached.expiry - 10000) {
        console.log(`[Using Cache] Key: ...${proxyKey.slice(-4)} | IP: ${cached.ip}`);
        return cached.ip;
    }

    // 2. Nếu hết hạn hoặc không có, gọi API lấy mới
    const relayUrl = `${RELAY_URL}?action=get_proxy&key=${proxyKey}&nhamang=${encodeURIComponent(isp)}&tinhthanh=${locationId}&t=${now}`;
    
    try {
        console.log("Fetching new proxy...", relayUrl);
        const res = await fetch(relayUrl);
        
        if (!res.ok) {
             throw new Error(`Lỗi HTTP ${res.status} từ Server Proxy.`);
        }

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Server trả về dữ liệu lỗi: ${text.substring(0, 50)}...`);
        }

        return handleProxyResponse(data, proxyKey);

    } catch (e: any) {
        console.error("Proxy Fetch Error:", e);
        
        // 3. Fallback mạnh mẽ: Nếu lỗi mạng hoặc server chết, nhưng ta VẪN còn cache (dù hết hạn)
        // -> Dùng liều cache cũ
        if (cached && cached.ip) {
            console.warn(`Fetch failed (${e.message}). Force reusing expired cache: ${cached.ip}`);
            // Gia hạn tạm 30s để người dùng làm việc tiếp
            saveProxyToCache(proxyKey, cached.ip, Date.now() + 30000);
            return cached.ip;
        }

        let msg = e.message;
        if (msg === 'Failed to fetch') {
            msg = 'Lỗi kết nối mạng tới Server Proxy. Vui lòng kiểm tra đường truyền.';
        }
        throw new Error(msg);
    }
}

/**
 * Kiểm tra kết nối Proxy và trả về thông tin IP
 */
export async function verifyProxyConnection(proxyKey: string, apiKey: string, isp: string = 'Random', locationId: string = '0'): Promise<{ myIp: string, proxyIp: string, success: boolean, message: string }> {
    try {
        // 1. Lấy IP gốc (chỉ để hiển thị so sánh)
        let myIp = "Unknown";
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            myIp = ipData.ip;
        } catch (e) {}

        // 2. Lấy Proxy (Quy trình chuẩn: Cache -> API -> Fallback)
        const proxyString = await getProxyXoay(proxyKey, isp, locationId);
        const proxyIp = proxyString.split(':')[0];

        // 3. Test kết nối tới 11Labs
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
                message: "Kết nối thành công! Proxy đang hoạt động tốt."
            };
        } else {
             const errText = await response.text();
             let msg = `Lỗi từ 11Labs: ${errText.substring(0, 100)}`;
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
      console.log(`Requesting via Relay: ${cleanBaseUrl} | Proxy: ${proxyUrl.split(':')[0]}`);
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
           throw new Error("Không thể kết nối tới Server Trung Gian. Vui lòng kiểm tra lại Proxy hoặc thử tắt Proxy.");
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
            errorMessage = "Lỗi 11Labs: Tài khoản đã đạt giới hạn Custom Voices. Vui lòng xóa bớt giọng cũ.";
        }

        if (errorMessage.includes("Unusual activity detected")) {
            let msg = "Lỗi 11Labs: Unusual activity detected.";
            if (!proxyKey) {
                msg += " Bạn cần bật Proxy Xoay để đổi IP.";
            } else {
                msg += " IP Proxy hiện tại đã bị chặn. Hệ thống sẽ tự động thử IP mới ở lần sau.";
                // Quan trọng: Xóa cache của key này để lần sau bắt buộc lấy IP mới
                saveProxyToCache(proxyKey, '', 0);
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

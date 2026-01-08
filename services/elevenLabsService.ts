
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";
const RELAY_URL = "https://gomhuongcanh.vn/ai_studio_code.php";

// --- CACHE MANAGEMENT START ---

// Helper để tạo key cho LocalStorage dựa trên Proxy Key (lấy 15 ký tự đầu để định danh)
const getStorageKey = (proxyKey: string) => `tts_proxy_cache_${proxyKey.trim().substring(0, 15)}`;

interface ProxyResult {
    proxy: string;     // IP:PORT dùng để kết nối (Entry Node)
    publicIp: string;  // IP Thật đầu ra (Exit Node)
}

interface ProxyCache {
    result: ProxyResult;
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

function saveProxyToCache(proxyKey: string, result: ProxyResult, expiry: number) {
    try {
        const data: ProxyCache = { result, expiry };
        localStorage.setItem(getStorageKey(proxyKey), JSON.stringify(data));
        console.log(`[Cache Saved] Key: ...${proxyKey.substring(proxyKey.length-4)} | RealIP: ${result.publicIp} | Entry: ${result.proxy}`);
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
function handleProxyResponse(data: any, proxyKey: string): ProxyResult {
    const rawMsg = data.msg || data.message || '';
    
    // Tìm kiếm proxyhttp (Entry)
    const proxyHttp = data.proxyhttp || (data.data && data.data.proxyhttp) || (data.data && data.data.ip);
    
    // Tìm kiếm public_ip (Exit - IP Thật)
    const publicIpRaw = data.public_ip || data.ip_public || (data.data && (data.data.public_ip || data.data.ip_public));
    
    // Fallback: nếu server không trả về public_ip riêng, ta tạm dùng phần IP của proxyHttp
    const finalPublicIp = publicIpRaw ? publicIpRaw : (typeof proxyHttp === 'string' ? proxyHttp.split(':')[0] : 'Unknown');

    // CASE 1: Thành công - Server trả về IP
    if (proxyHttp && typeof proxyHttp === 'string') {
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
        
        const result: ProxyResult = {
            proxy: proxyHttp,
            publicIp: finalPublicIp
        };
        
        saveProxyToCache(proxyKey, result, newExpiry);
        return result;
    }

    // CASE 2: Cooldown - Server bắt đợi
    if (typeof rawMsg === 'string') {
        const waitMatch = rawMsg.match(/Con (\d+)s moi co the doi proxy/i);
        if (waitMatch) {
            const seconds = parseInt(waitMatch[1]);
            
            // Cứu cánh: Kiểm tra xem có cache cũ không (bất kể hết hạn chưa)
            const cached = getProxyFromCache(proxyKey);
            if (cached && cached.result) {
                console.warn(`[Proxy Cooldown] Wait ${seconds}s. REUSING cached IP: ${cached.result.publicIp}`);
                // Cập nhật lại expiry ảo để các request tiếp theo trong vài giây tới không spam server
                const safeExpiry = Date.now() + (seconds * 1000) + 5000;
                saveProxyToCache(proxyKey, cached.result, safeExpiry);
                return cached.result;
            }
            
            // Nếu không có cache (Lần đầu nhập key đang bị cooldown)
            // Code getProxyXoay sẽ bắt error này để thực hiện auto-retry
            throw new Error(`Proxy đang chờ đổi IP (${seconds}s). Vui lòng thử lại sau ${seconds} giây.`);
        }
    }

    // CASE 3: Lỗi khác
    if (data.status && data.status !== 100) {
        throw new Error(`Lỗi ProxyXoay: ${rawMsg || 'Key không hợp lệ hoặc lỗi không xác định'}`);
    }
    
    // CASE 4: JSON có vẻ thành công nhưng không tìm thấy IP
    throw new Error(`Server trả về dữ liệu nhưng không tìm thấy IP: ${JSON.stringify(data)}`);
}

/**
 * Lấy Proxy từ proxyxoay.shop thông qua Relay Server
 */
async function getProxyXoay(proxyKey: string, isp: string = 'Random', locationId: string = '0', retryCount: number = 0): Promise<ProxyResult> {
    const now = Date.now();
    const cached = getProxyFromCache(proxyKey);
    
    // 1. Kiểm tra Cache còn hạn không (chỉ ưu tiên cache ở lần thử đầu tiên)
    if (retryCount === 0 && cached && now < cached.expiry - 10000) {
        console.log(`[Using Cache] Key: ...${proxyKey.slice(-4)} | IP: ${cached.result.publicIp}`);
        return cached.result;
    }

    // 2. Nếu hết hạn hoặc không có, gọi API lấy mới
    // Thêm tham số rand để chống cache trình duyệt triệt để
    const rand = Math.random().toString(36).substring(7);
    const relayUrl = `${RELAY_URL}?action=get_proxy&key=${proxyKey}&nhamang=${encodeURIComponent(isp)}&tinhthanh=${locationId}&t=${now}&r=${rand}`;
    
    try {
        console.log(`Fetching new proxy (Attempt ${retryCount + 1})...`, relayUrl);
        // QUAN TRỌNG: Không gửi headers Cache-Control để tránh lỗi CORS
        const res = await fetch(relayUrl);
        
        // Cố gắng đọc body text dù status code là gì
        const text = await res.text();
        let data;
        
        try {
            data = JSON.parse(text);
        } catch (e) {
            // Nếu không phải JSON và status lỗi, ném lỗi HTTP
            if (!res.ok) throw new Error(`Lỗi HTTP ${res.status}: ${text.substring(0, 100)}`);
            // Nếu status OK mà không parse được JSON
            throw new Error(`Dữ liệu Proxy không hợp lệ: ${text.substring(0, 50)}...`);
        }
        
        // Nếu HTTP lỗi nhưng parse được JSON (ví dụ server trả về 400 kèm message lỗi), tiếp tục xử lý
        return handleProxyResponse(data, proxyKey);

    } catch (e: any) {
        console.warn(`Proxy Fetch Warning (Attempt ${retryCount + 1}):`, e.message);
        
        // --- AUTO-RETRY LOGIC ---
        // Check if error is a Cooldown error
        const waitMatch = e.message.match(/Proxy đang chờ đổi IP \((\d+)s\)/);
        if (waitMatch) {
             const seconds = parseInt(waitMatch[1]);
             // Tự động chờ nếu thời gian < 90s và chưa retry quá 3 lần
             if (seconds <= 90 && retryCount < 3) {
                 const waitTime = seconds + 5; // Thêm 5s buffer cho chắc chắn
                 console.log(`[Auto-Retry] Detected cooldown. Sleeping for ${waitTime}s...`);
                 
                 await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                 
                 // Gọi đệ quy để thử lại
                 return getProxyXoay(proxyKey, isp, locationId, retryCount + 1);
             }
        }
        // ------------------------

        // 3. Fallback: Nếu lỗi mạng/server/cooldown mà vẫn còn cache (dù hết hạn) -> Dùng tạm
        if (cached && cached.result) {
            console.warn(`Fetch failed after retries. Force reusing expired cache: ${cached.result.publicIp}`);
            // Gia hạn tạm 30s
            saveProxyToCache(proxyKey, cached.result, Date.now() + 30000);
            return cached.result;
        }

        let msg = e.message;
        if (msg === 'Failed to fetch') {
            msg = 'Lỗi kết nối mạng tới Server Proxy. Có thể do CORS chặn headers hoặc mạng yếu.';
        }
        throw new Error(msg);
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
        } catch (e) {}

        // 2. Lấy Proxy
        const proxyData = await getProxyXoay(proxyKey, isp, locationId);
        // HIỂN THỊ Public IP (IP Thật) cho người dùng thấy, thay vì hiển thị IP Proxy trung gian
        const displayIp = proxyData.publicIp; 

        // 3. Test kết nối tới 11Labs
        const response = await fetch(`${RELAY_URL}/models`, {
            method: 'GET',
            headers: {
                "xi-api-key": apiKey,
                "X-Proxy-Url": proxyData.proxy // HEADER vẫn phải dùng Proxy Entry để kết nối
            }
        });

        if (response.ok) {
            return {
                myIp,
                proxyIp: displayIp, // Trả về IP thật để hiển thị UI
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
                proxyIp: displayIp,
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

  let cleanBaseUrl = (proxyKey ? RELAY_URL : baseUrl).replace(/\/$/, "");

  let proxyUrl = "";
  if (proxyKey) {
      try {
          const proxyData = await getProxyXoay(proxyKey, proxyISP, proxyLocation);
          proxyUrl = proxyData.proxy; // Dùng IP Entry để tạo header
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
                // Xóa cache của key này để lần sau bắt buộc lấy IP mới
                saveProxyToCache(proxyKey, {proxy: '', publicIp: ''}, 0);
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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { generateSpeech, generateSpeechBytes } from './services/geminiService';
import { fetchElevenLabsVoices, fetchElevenLabsModels, generateElevenLabsSpeechBytes } from './services/elevenLabsService';
import { AudioResult, ApiKey, TtsProvider, ElevenLabsVoice, ElevenLabsModel } from './types';
import { FileUploader } from './components/FileUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { ZipIcon } from './components/icons/ZipIcon';
import { ThemeSelector } from './components/ThemeSelector';
import { themes, ThemeName } from './themes';
import { PlayIcon } from './components/icons/PlayIcon';
import { ApiKeyModal } from './components/ApiKeyModal';
import { KeyIcon } from './components/icons/KeyIcon';
import { parseSrt } from './utils/srtParser';
import { createSilence, concatenatePcm, getPcmDuration, createWavBlob } from './utils/audioUtils';
import { SrtResultPlayer } from './components/SrtResultPlayer';


const geminiVoiceOptions = [
  // Giọng Nữ
  { id: 'kore', name: 'Nữ: Kore (Trầm tĩnh)' },
  { id: 'zephyr', name: 'Nữ: Zephyr (Thân thiện)' },
  { id: 'pulcherrima', name: 'Nữ: Pulcherrima (Trong trẻo)' },
  { id: 'vindemiatrix', name: 'Nữ: Vindemiatrix (Mềm mại)' },
  // Giọng Nam
  { id: 'puck', name: 'Nam: Puck (Năng lượng)' },
  { id: 'charon', name: 'Nam: Charon (Trầm)' },
  { id: 'fenrir', name: 'Nam: Fenrir (Uy quyền)' },
  { id: 'orus', name: 'Nam: Orus (Ấm áp)' },
  { id: 'rasalgethi', name: 'Nam: Rasalgethi (Rõ ràng)' },
];

const App: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<'txt' | 'srt' | null>(null);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  
  // Gemini State
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>('kore');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('other'); 
  const [selectedRegion, setSelectedRegion] = useState<string>('bac'); 

  // ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [elevenLabsModels, setElevenLabsModels] = useState<ElevenLabsModel[]>([]);
  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>('');
  const [selectedElevenLabsModel, setSelectedElevenLabsModel] = useState<string>('eleven_multilingual_v2');
  const [isLoadingElevenLabs, setIsLoadingElevenLabs] = useState<boolean>(false);

  // Common State
  const [audioResults, setAudioResults] = useState<AudioResult[]>([]);
  const [srtResult, setSrtResult] = useState<{ audioUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>('green');
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
  
  // API Key State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Load theme
   useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme');
      if (savedTheme && Object.keys(themes).includes(savedTheme)) {
        setTheme(savedTheme as ThemeName);
      }
    } catch (e) {
       console.error(String(e as any));
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const themeColors = themes[theme];
    for (const [key, value] of Object.entries(themeColors)) {
      root.style.setProperty(`--color-primary-${key}`, value);
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);
  
  // Load API keys
  useEffect(() => {
    try {
      const savedKeys = localStorage.getItem('apiKeys');
      const savedActiveKeyId = localStorage.getItem('activeApiKeyId');
      const savedElevenLabsKey = localStorage.getItem('elevenLabsApiKey');

      if (savedKeys) {
        const keys = JSON.parse(savedKeys);
        setApiKeys(keys);
        if (savedActiveKeyId) {
          const activeId = parseInt(savedActiveKeyId, 10);
          if (keys.some((k: ApiKey) => k.id === activeId)) setActiveKeyId(activeId);
          else if (keys.length > 0) setActiveKeyId(keys[0].id);
        } else if (keys.length > 0) {
           setActiveKeyId(keys[0].id);
        }
      }
      
      if (savedElevenLabsKey) {
          setElevenLabsApiKey(savedElevenLabsKey);
      }

    } catch (error) {
      console.error(error);
    }
  }, []);

  // Fetch ElevenLabs Data when key is available and provider is selected
  useEffect(() => {
    if (ttsProvider === 'elevenlabs' && elevenLabsApiKey && elevenLabsVoices.length === 0) {
        setIsLoadingElevenLabs(true);
        Promise.all([
            fetchElevenLabsVoices(elevenLabsApiKey),
            fetchElevenLabsModels(elevenLabsApiKey)
        ]).then(([voices, models]) => {
            setElevenLabsVoices(voices);
            setElevenLabsModels(models);
            if (voices.length > 0) setSelectedElevenLabsVoice(voices[0].voice_id);
            // Ensure default model exists or select the first available one
            if (!models.some(m => m.model_id === selectedElevenLabsModel)) {
                 // Ưu tiên chọn các model phổ biến nếu có
                 const preferredModel = models.find(m => m.model_id === 'eleven_multilingual_v2') 
                                     || models.find(m => m.model_id === 'eleven_turbo_v2_5')
                                     || models[0];
                 if (preferredModel) setSelectedElevenLabsModel(preferredModel.model_id);
            }
            setError(null);
        }).catch((err: any) => {
            setError(`Không thể tải dữ liệu ElevenLabs: ${err?.message || String(err)}`);
        }).finally(() => {
            setIsLoadingElevenLabs(false);
        });
    }
  }, [ttsProvider, elevenLabsApiKey, elevenLabsVoices.length, selectedElevenLabsModel]);


  // Cleanup object URLs
  useEffect(() => {
    return () => {
      audioResults.forEach(result => URL.revokeObjectURL(result.audioUrl));
       if (previewAudioRef.current) {
        URL.revokeObjectURL(previewAudioRef.current.src);
      }
      if (srtResult) {
        URL.revokeObjectURL(srtResult.audioUrl);
      }
    };
  }, [audioResults, srtResult]);
  
  const updateActiveKey = useCallback((id: number) => {
    setActiveKeyId(id);
    localStorage.setItem('activeApiKeyId', id.toString());
  }, []);

  const saveElevenLabsKey = (key: string) => {
      setElevenLabsApiKey(key);
      localStorage.setItem('elevenLabsApiKey', key);
      // Clear cached data to force refetch if key changes
      setElevenLabsVoices([]); 
      setElevenLabsModels([]);
  }

  const performApiCallWithRetry = useCallback(async <T extends any[], R>(
    apiFunction: (...args: [...T, string]) => Promise<R>,
    ...args: T
  ): Promise<R> => {
    if (apiKeys.length === 0) {
      throw new Error('Không có API key Gemini nào được cấu hình.');
    }
  
    const startIndex = activeKeyId ? Math.max(0, apiKeys.findIndex(k => k.id === activeKeyId)) : 0;
    const orderedApiKeys = [...apiKeys.slice(startIndex), ...apiKeys.slice(0, startIndex)];
  
    let lastError: Error | null = null;
  
    for (const key of orderedApiKeys) {
      try {
        const result = await apiFunction(...args, key.key);
        if (key.id !== activeKeyId) updateActiveKey(key.id);
        setError(null);
        return result;
      } catch (err) {
        if (err instanceof Error) {
          lastError = err;
          const isKeyError = err.message.includes('API key not valid') || err.message.includes('API key is invalid') || err.message.includes('permission to access');
          if (isKeyError) continue; else throw err;
        }
        throw err;
      }
    }
    throw new Error(`Tất cả các API key đều không thành công. Lỗi: ${lastError?.message}`);
  }, [apiKeys, activeKeyId, updateActiveKey]);

  const handleFileSelect = useCallback((content: string, fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'txt') setFileType('txt');
    else if (extension === 'srt') setFileType('srt');
    else {
      setFileType(null);
      setFileContent('');
      setError('Tệp không hợp lệ.');
      return;
    }
    setFileContent(content);
    setAudioResults([]);
    if (srtResult) URL.revokeObjectURL(srtResult.audioUrl);
    setSrtResult(null);
    setError(null);
  }, [srtResult]);
  
  const handleAddKey = (key: string) => {
    const newKey: ApiKey = { id: Date.now(), key };
    const updatedKeys = [...apiKeys, newKey];
    setApiKeys(updatedKeys);
    localStorage.setItem('apiKeys', JSON.stringify(updatedKeys));
    if (!activeKeyId) {
      setActiveKeyId(newKey.id);
      localStorage.setItem('activeApiKeyId', newKey.id.toString());
    }
  };

  const handleDeleteKey = (id: number) => {
    const updatedKeys = apiKeys.filter(key => key.id !== id);
    setApiKeys(updatedKeys);
    localStorage.setItem('apiKeys', JSON.stringify(updatedKeys));
    if (activeKeyId === id) {
      const newActiveKey = updatedKeys.length > 0 ? updatedKeys[0].id : null;
      setActiveKeyId(newActiveKey);
      if (newActiveKey) localStorage.setItem('activeApiKeyId', newActiveKey.toString());
      else localStorage.removeItem('activeApiKeyId');
    }
  };

  const getElevenLabsLanguageCode = () => {
      // Map app language selection to ISO codes ElevenLabs might use (or for logic)
      if (selectedLanguage === 'vietnam') return 'vi';
      if (selectedLanguage === 'other') return 'en'; // Default or unspecified
      return undefined;
  };

  const handlePreviewVoice = async () => {
    if (isLoading || isPreviewLoading) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
      previewAudioRef.current = null;
    }
  
    setIsPreviewLoading(true);
    setError(null);
    const sampleText = selectedLanguage === 'vietnam'
        ? "Xin chào, đây là bản xem trước giọng nói của tôi."
        : "Hello, this is a preview of my voice.";
    
    try {
      let audioUrl: string;
      if (ttsProvider === 'gemini') {
           audioUrl = await performApiCallWithRetry(generateSpeech, sampleText, selectedGeminiVoice);
      } else {
           if (!elevenLabsApiKey) throw new Error("Vui lòng nhập API Key ElevenLabs");
           const langCode = getElevenLabsLanguageCode();
           const bytes = await generateElevenLabsSpeechBytes(sampleText, selectedElevenLabsVoice, selectedElevenLabsModel, elevenLabsApiKey, langCode);
           const blob = createWavBlob(bytes);
           audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.error(e);
          setError("Không thể tự động phát. Kiểm tra quyền trình duyệt.");
          URL.revokeObjectURL(audioUrl);
          setIsPreviewLoading(false);
        });
      }
  
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPreviewLoading(false);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
           URL.revokeObjectURL(audioUrl);
           setError('Không thể phát âm thanh xem trước.');
           setIsPreviewLoading(false);
           previewAudioRef.current = null;
      }
    } catch (err) {
      if (err instanceof Error) setError(`Lỗi: ${err.message}`);
      setIsPreviewLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!fileContent) {
      setError('Vui lòng nhập nội dung.');
      return;
    }
    if (ttsProvider === 'elevenlabs' && !elevenLabsApiKey) {
        setError('Vui lòng cấu hình API Key ElevenLabs.');
        setIsModalOpen(true);
        return;
    }

    setIsLoading(true);
    setError(null);
    setAudioResults([]);
    if (srtResult) URL.revokeObjectURL(srtResult.audioUrl);
    setSrtResult(null);
    setProgress(null);

    const getInstruction = () => {
        if (ttsProvider === 'elevenlabs') return ''; // ElevenLabs performs better without instructional prompting
        if (selectedLanguage !== 'vietnam') return 'Hãy đọc đoạn văn sau: ';
        switch (selectedRegion) {
            case 'bac': return 'Nói bằng giọng miền Bắc: ';
            case 'trung': return 'Nói bằng giọng miền Trung: ';
            case 'nam': return 'Nói bằng giọng miền Nam: ';
            default: return '';
        }
    };
    const instruction = getInstruction();

    try {
      if (fileType === 'srt') {
          const subtitles = parseSrt(fileContent);
          if (subtitles.length === 0) {
            throw new Error('SRT không hợp lệ.');
          }

          let currentTime = 0;
          const audioChunks: Uint8Array[] = [];
          setProgress({ current: 0, total: subtitles.length });

          const langCode = ttsProvider === 'elevenlabs' ? getElevenLabsLanguageCode() : undefined;

          for (let i = 0; i < subtitles.length; i++) {
            const sub = subtitles[i];
            setProgress({ current: i + 1, total: subtitles.length });

            const silenceDuration = sub.startTime - currentTime;
            if (silenceDuration > 0) audioChunks.push(createSilence(silenceDuration));

            const textToRead = `${instruction}${sub.text}`;
            let speechBytes: Uint8Array;

            if (ttsProvider === 'gemini') {
                 speechBytes = await performApiCallWithRetry(generateSpeechBytes, textToRead, selectedGeminiVoice);
                 // Delay for Gemini Rate Limit
                 if (i < subtitles.length - 1) await new Promise(r => setTimeout(r, 21000));
            } else {
                 speechBytes = await generateElevenLabsSpeechBytes(sub.text, selectedElevenLabsVoice, selectedElevenLabsModel, elevenLabsApiKey, langCode);
                 // Smaller delay for ElevenLabs (mostly for network stability, they have different rate limits)
                 // Note: ElevenLabs is expensive for SRTs!
            }

            audioChunks.push(speechBytes);
            const speechDuration = getPcmDuration(speechBytes);
            currentTime = sub.startTime + speechDuration;
          }

          const finalPcm = concatenatePcm(audioChunks);
          const finalWavBlob = createWavBlob(finalPcm);
          setSrtResult({ audioUrl: URL.createObjectURL(finalWavBlob) });

      } else {
          const paragraphs = fileContent.split('\n').filter(p => p.trim() !== '');
          if (paragraphs.length === 0) throw new Error('Không có nội dung.');
          
          setProgress({ current: 0, total: paragraphs.length });

          const langCode = ttsProvider === 'elevenlabs' ? getElevenLabsLanguageCode() : undefined;

          for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            setProgress({ current: i + 1, total: paragraphs.length });
            const textToRead = `${instruction}${p}`;
            
            let audioUrl: string;
            let speechBytes: Uint8Array;

            if (ttsProvider === 'gemini') {
                 audioUrl = await performApiCallWithRetry(generateSpeech, textToRead, selectedGeminiVoice);
                 if (i < paragraphs.length - 1) await new Promise(r => setTimeout(r, 21000));
            } else {
                 speechBytes = await generateElevenLabsSpeechBytes(p, selectedElevenLabsVoice, selectedElevenLabsModel, elevenLabsApiKey, langCode);
                 const blob = createWavBlob(speechBytes);
                 audioUrl = URL.createObjectURL(blob);
            }
            
            setAudioResults(prev => [...prev, { id: i, text: p, audioUrl }]);
          }
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Lỗi không xác định.');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleDownloadAll = async () => {
    if (audioResults.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      await Promise.all(audioResults.map(async (res) => {
          const blob = await (await fetch(res.audioUrl)).blob();
          zip.file(`segment_${res.id + 1}.wav`, blob);
      }));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'audio_clips.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Lỗi tạo zip.');
    } finally {
      setIsZipping(false);
    }
  };
  
  const isDisabled = isLoading || isPreviewLoading;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col">
       <style>{`
        .results-scrollbar::-webkit-scrollbar { width: 8px; }
        .results-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .results-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--color-primary-700);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .results-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: var(--color-primary-600);
        }
      `}</style>
      <header className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-slate-700 shadow-lg flex items-center justify-between sticky top-0 z-10">
        <div className="flex-1"></div>
        <div className="text-center flex-grow">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-[--color-primary-400] transition-colors">
            Chuyển đổi Tệp Văn bản sang Giọng nói
          </h1>
          <p className="text-center text-slate-400 mt-1">Cung cấp bởi Gemini & ElevenLabs</p>
        </div>
        <div className="flex-1 flex items-center justify-end space-x-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
              title="Cài đặt API Keys"
            >
              <KeyIcon />
              <span className="hidden md:inline">API Keys</span>
            </button>
            <ThemeSelector currentTheme={theme} onThemeChange={setTheme} />
        </div>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Control Panel */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6 flex flex-col space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-semibold text-[--color-primary-300] mb-3 transition-colors">1. Cung cấp Văn bản</h2>
            <FileUploader onFileSelect={handleFileSelect} disabled={isDisabled} />
             <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-[--color-primary-500]/30 transition-colors"></div>
              <span className="flex-shrink mx-4 text-slate-500">HOẶC</span>
              <div className="flex-grow border-t border-[--color-primary-500]/30 transition-colors"></div>
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => {
                setFileContent(e.target.value);
                setFileType(null);
              }}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200 min-h-[200px]"
              placeholder="Dán hoặc gõ văn bản của bạn trực tiếp vào đây..."
              disabled={isDisabled}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
                 <h2 className="text-xl font-semibold text-[--color-primary-300] transition-colors">2. Cấu hình Giọng đọc</h2>
                 <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <button 
                        onClick={() => setTtsProvider('gemini')}
                        className={`px-3 py-1 text-sm rounded-md transition-all ${ttsProvider === 'gemini' ? 'bg-[--color-primary-600] text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        disabled={isDisabled}
                    >Gemini</button>
                    <button 
                        onClick={() => setTtsProvider('elevenlabs')}
                        className={`px-3 py-1 text-sm rounded-md transition-all ${ttsProvider === 'elevenlabs' ? 'bg-[--color-primary-600] text-white shadow' : 'text-slate-400 hover:text-white'}`}
                         disabled={isDisabled}
                    >ElevenLabs</button>
                 </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Language Selection (Common for both, now enabled for ElevenLabs) */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Ngôn ngữ</label>
                    <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        disabled={isDisabled}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300"
                    >
                        <option value="vietnam">Việt Nam</option>
                        <option value="other">Quốc tế (English)</option>
                    </select>
                </div>

                {ttsProvider === 'gemini' ? (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Vùng miền (VN)</label>
                            <select
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            disabled={isDisabled || selectedLanguage !== 'vietnam'}
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                            >
                            <option value="bac">Miền Bắc</option>
                            <option value="trung">Miền Trung</option>
                            <option value="nam">Miền Nam</option>
                            </select>
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-2">Giọng đọc</label>
                            <div className="flex items-center space-x-2">
                            <select
                                value={selectedGeminiVoice}
                                onChange={(e) => setSelectedGeminiVoice(e.target.value)}
                                disabled={isDisabled}
                                className="flex-grow bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300"
                            >
                                {geminiVoiceOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                             <button onClick={handlePreviewVoice} disabled={isDisabled} className="p-3 rounded-lg bg-slate-700 hover:bg-[--color-primary-600]/50 disabled:opacity-50">
                                {isPreviewLoading ? <SpinnerIcon hasMargin={false} /> : <PlayIcon />}
                            </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                         {/* ElevenLabs Controls */}
                         {!elevenLabsApiKey && (
                             <div className="md:col-span-2 bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 p-3 rounded-lg text-sm mb-2">
                                 Bạn cần nhập API Key của ElevenLabs trong phần cài đặt (nút Chìa khóa).
                             </div>
                         )}
                         <div>
                            {/* Empty placeholder or additional controls if needed */}
                         </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-2">Mô hình (Model)</label>
                            <select
                                value={selectedElevenLabsModel}
                                onChange={(e) => setSelectedElevenLabsModel(e.target.value)}
                                disabled={isDisabled || isLoadingElevenLabs || !elevenLabsApiKey}
                                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                            >
                                {elevenLabsModels.length > 0 
                                    ? elevenLabsModels.map(m => <option key={m.model_id} value={m.model_id}>{m.name}</option>)
                                    : <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
                                }
                            </select>
                            {selectedLanguage === 'vietnam' && selectedElevenLabsModel.includes('english') && (
                                <p className="text-xs text-yellow-500 mt-1">
                                    Cảnh báo: Model 'English' có thể không đọc tốt tiếng Việt. Hãy chọn 'Multilingual' hoặc 'Turbo'.
                                </p>
                            )}
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-2">Giọng đọc (Voice)</label>
                             <div className="flex items-center space-x-2">
                                <select
                                    value={selectedElevenLabsVoice}
                                    onChange={(e) => setSelectedElevenLabsVoice(e.target.value)}
                                    disabled={isDisabled || isLoadingElevenLabs || !elevenLabsApiKey}
                                    className="flex-grow bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                                >
                                    {isLoadingElevenLabs && <option>Đang tải danh sách giọng...</option>}
                                    {!isLoadingElevenLabs && elevenLabsVoices.length === 0 && <option>Không tìm thấy giọng (Kiểm tra Key)</option>}
                                    {elevenLabsVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                                </select>
                                <button onClick={handlePreviewVoice} disabled={isDisabled || !elevenLabsApiKey || !selectedElevenLabsVoice} className="p-3 rounded-lg bg-slate-700 hover:bg-[--color-primary-600]/50 disabled:opacity-50">
                                    {isPreviewLoading ? <SpinnerIcon hasMargin={false} /> : <PlayIcon />}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            {ttsProvider === 'gemini' && selectedLanguage === 'vietnam' && (
              <p className="text-xs text-slate-500 pt-4 text-center">
                Gemini: Tính năng chọn giọng theo vùng miền là thử nghiệm.
              </p>
            )}
             {ttsProvider === 'elevenlabs' && (
              <p className="text-xs text-slate-500 pt-4 text-center">
                Lưu ý: ElevenLabs tính phí theo ký tự. Sử dụng file SRT lớn sẽ tiêu tốn nhiều credits.
              </p>
            )}
          </div>


          <div>
            <h2 className="text-xl font-semibold text-[--color-primary-300] mb-3 transition-colors">3. Tạo âm thanh</h2>
             <button
              onClick={handleGenerateAudio}
              disabled={isDisabled || !fileContent}
              className="w-full flex items-center justify-center bg-[--color-primary-600] hover:bg-[--color-primary-500] disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  Đang tạo...
                </>
              ) : 'Tạo Clip Âm thanh'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
            <h2 className="text-xl font-semibold text-[--color-primary-300] transition-colors">Kết quả</h2>
            {fileType !== 'srt' && audioResults.length > 0 && !isLoading && (
              <button
                onClick={handleDownloadAll}
                disabled={isZipping}
                className="flex items-center justify-center bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
              >
                {isZipping ? (
                  <>
                    <SpinnerIcon />
                    <span>Đang nén...</span>
                  </>
                ) : (
                  <>
                    <ZipIcon />
                    <span>Tải Tất cả (.zip)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
          
          {isLoading && audioResults.length === 0 && (
             <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                <SpinnerIcon hasMargin={false} />
                 {progress ? (
                  <>
                    <p className="mt-4">Đang xử lý... ({progress.current}/{progress.total})</p>
                    {ttsProvider === 'gemini' && <p className="text-sm text-slate-500 mt-1">Khoảng trễ giữa các yêu cầu được áp dụng để tránh lỗi API.</p>}
                  </>
                ) : (
                  <p className="mt-4">Đang khởi tạo...</p>
                )}
            </div>
          )}

          {!isLoading && audioResults.length === 0 && !srtResult && !error && (
            <div className="flex items-center justify-center text-slate-500 h-64">
              Kết quả sẽ hiển thị ở đây.
            </div>
          )}

          {srtResult && !isLoading && <SrtResultPlayer audioUrl={srtResult.audioUrl} />}

          {(audioResults.length > 0) && (
            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 results-scrollbar">
              {audioResults.map((result) => (
                <AudioPlayer key={result.id} result={result} />
              ))}
               {isLoading && (
                <div className="flex flex-col items-center justify-center text-slate-400 py-8">
                  <SpinnerIcon hasMargin={false} />
                  {progress && <p className="mt-4">Đang xử lý... ({progress.current}/{progress.total})</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        apiKeys={apiKeys}
        activeKeyId={activeKeyId}
        onAddKey={handleAddKey}
        onDeleteKey={handleDeleteKey}
        onSetActiveKey={(id) => { setActiveKeyId(id); localStorage.setItem('activeApiKeyId', id.toString()); }}
        elevenLabsApiKey={elevenLabsApiKey}
        onElevenLabsKeyChange={saveElevenLabsKey}
      />
    </div>
  );
};

export default App;
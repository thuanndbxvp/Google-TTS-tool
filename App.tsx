

import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { generateSpeech } from './services/geminiService';
import { AudioResult, ApiKey } from './types';
import { FileUploader } from './components/FileUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { ZipIcon } from './components/icons/ZipIcon';
import { ThemeSelector } from './components/ThemeSelector';
import { themes, ThemeName } from './themes';
import { PlayIcon } from './components/icons/PlayIcon';
import { ApiKeyModal } from './components/ApiKeyModal';
import { KeyIcon } from './components/icons/KeyIcon';


const voiceOptions = [
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
  const [textFileContent, setTextFileContent] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>('kore');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('other'); // 'vietnam' or 'other'
  const [selectedRegion, setSelectedRegion] = useState<string>('bac'); // 'bac', 'trung', 'nam'
  const [audioResults, setAudioResults] = useState<AudioResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>('green');
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // API Key State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Load theme from localStorage
   useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme');
      if (savedTheme && Object.keys(themes).includes(savedTheme)) {
        setTheme(savedTheme as ThemeName);
      }
    } catch (e) {
      // FIX: Explicitly handle unknown error type before logging.
      if (e instanceof Error) {
        console.error("Failed to load theme from localStorage", e.message);
      } else {
        console.error("Failed to load theme from localStorage", String(e));
      }
    }
  }, []);

  // Apply and save theme
  useEffect(() => {
    const root = document.documentElement;
    const themeColors = themes[theme];
    
    for (const [key, value] of Object.entries(themeColors)) {
      root.style.setProperty(`--color-primary-${key}`, value);
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);
  
  // Load API keys from localStorage
  useEffect(() => {
    try {
      const savedKeys = localStorage.getItem('apiKeys');
      const savedActiveKeyId = localStorage.getItem('activeApiKeyId');
      if (savedKeys) {
        const keys = JSON.parse(savedKeys);
        setApiKeys(keys);
        if (savedActiveKeyId) {
          const activeId = parseInt(savedActiveKeyId, 10);
          if (keys.some((k: ApiKey) => k.id === activeId)) {
            setActiveKeyId(activeId);
          } else if (keys.length > 0) {
            setActiveKeyId(keys[0].id);
            localStorage.setItem('activeApiKeyId', keys[0].id.toString());
          }
        } else if (keys.length > 0) {
           setActiveKeyId(keys[0].id);
           localStorage.setItem('activeApiKeyId', keys[0].id.toString());
        }
      }
    } catch (error) {
      // FIX: Handle unknown error type before logging.
      if (error instanceof Error) {
        console.error("Failed to load API keys from localStorage", error.message);
      } else {
        console.error("Failed to load API keys from localStorage", String(error));
      }
      localStorage.removeItem('apiKeys');
      localStorage.removeItem('activeApiKeyId');
    }
}, []);


  // Cleanup object URLs
  useEffect(() => {
    return () => {
      audioResults.forEach(result => URL.revokeObjectURL(result.audioUrl));
       if (previewAudioRef.current) {
        URL.revokeObjectURL(previewAudioRef.current.src);
      }
    };
  }, [audioResults]);

  const handleFileSelect = useCallback((content: string, fileName: string) => {
    setTextFileContent(content);
    setAudioResults([]);
    setError(null);
  }, []);
  
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
      if (newActiveKey) {
          localStorage.setItem('activeApiKeyId', newActiveKey.toString());
      } else {
          localStorage.removeItem('activeApiKeyId');
      }
    }
  };

  const handleSetActiveKey = (id: number) => {
    setActiveKeyId(id);
    localStorage.setItem('activeApiKeyId', id.toString());
    setIsModalOpen(false);
  };
  

  const handlePreviewVoice = async () => {
    if (isLoading || isPreviewLoading) return;
  
    const activeKey = apiKeys.find(k => k.id === activeKeyId)?.key;
    if (!activeKey) {
      setError('Vui lòng thêm và chọn một API key đang hoạt động trong phần quản lý.');
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
      previewAudioRef.current = null;
    }
  
    setIsPreviewLoading(true);
    setError(null);
  
    const sampleText = "Xin chào, đây là bản xem trước giọng nói của tôi.";
    
    try {
      const audioUrl = await generateSpeech(sampleText, selectedVoice, activeKey);
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Audio playback failed:", error);
          setError("Không thể tự động phát âm thanh xem trước. Vui lòng kiểm tra cài đặt trình duyệt của bạn.");
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
           setError('Không thể phát tệp âm thanh xem trước.');
           setIsPreviewLoading(false);
           previewAudioRef.current = null;
      }
    } catch (err) {
      // FIX: Handle unknown error type before logging and setting state.
      if (err instanceof Error) {
        console.error('Error generating preview audio:', err.message);
        setError(`Lỗi khi tạo bản xem trước: ${err.message}`);
      } else {
        console.error('Error generating preview audio:', String(err));
        setError('Không thể tạo âm thanh xem trước.');
      }
      setIsPreviewLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!textFileContent) {
      setError('Vui lòng tải lên một tệp văn bản hoặc nhập văn bản trước.');
      return;
    }

    const activeKey = apiKeys.find(k => k.id === activeKeyId)?.key;
    if (!activeKey) {
        setError('Vui lòng thêm và chọn một API key đang hoạt động trong phần quản lý.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setAudioResults([]);

    const getRegionInstruction = (region: string, language: string): string => {
      if (language !== 'vietnam') {
        return 'Hãy đọc đoạn văn sau: ';
      }
      switch (region) {
        case 'bac': return 'Nói bằng giọng miền Bắc: ';
        case 'trung': return 'Nói bằng giọng miền Trung: ';
        case 'nam': return 'Nói bằng giọng miền Nam: ';
        default: return '';
      }
    };
    const instruction = getRegionInstruction(selectedRegion, selectedLanguage);
    const paragraphs = textFileContent.split('\n').filter(p => p.trim() !== '');

    if (paragraphs.length === 0) {
      setError('Nội dung văn bản trống hoặc không chứa đoạn văn nào có thể đọc được.');
      setIsLoading(false);
      return;
    }
    
    try {
      const results = await Promise.all(
        paragraphs.map(async (p, index) => {
          const textWithInstruction = `${instruction}${p}`;
          const audioUrl = await generateSpeech(textWithInstruction, selectedVoice, activeKey);
          return { id: index, text: p, audioUrl };
        })
      );
      setAudioResults(results);
    } catch (err) {
      // FIX: Handle unknown error type before logging and setting state.
      if (err instanceof Error) {
        console.error('Error generating audio:', err.message);
        if (err.message.includes('API key not valid') || err.message.includes('API key is invalid') || err.message.includes('permission to access')) {
          setError('Đã xảy ra lỗi API. Vui lòng kiểm tra lại API key đang hoạt động trong phần quản lý. Key có thể không hợp lệ hoặc không có quyền cần thiết.');
        } else if (err.message.includes('is not supported')) {
          setError(`Lỗi API: ${err.message}. Giọng đọc được chọn có thể không hợp lệ. Vui lòng thử một giọng đọc khác.`);
        } else {
          setError(`Đã xảy ra lỗi không mong muốn: ${err.message}`);
        }
      } else {
        console.error('Error generating audio:', String(err));
        setError('Tạo âm thanh thất bại. Vui lòng kiểm tra kết nối mạng và API key của bạn.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (audioResults.length === 0) return;
  
    setIsZipping(true);
    setError(null);
  
    try {
      const zip = new JSZip();
  
      await Promise.all(
        audioResults.map(async (result) => {
          const response = await fetch(result.audioUrl);
          const audioBlob = await response.blob();
          zip.file(`segment_${result.id + 1}.wav`, audioBlob);
        })
      );
  
      const zipBlob = await zip.generateAsync({ type: 'blob' });
  
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'audio_clips.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
  
    } catch (err) {
      // FIX: Handle unknown error type before logging and setting state.
      if (err instanceof Error) {
        console.error('Failed to create zip file:', err.message);
        setError(`Không thể tạo tệp zip để tải xuống: ${err.message}`);
      } else {
        console.error('Failed to create zip file:', String(err));
        setError('Không thể tạo tệp zip để tải xuống do một lỗi không xác định.');
      }
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
          <p className="text-center text-slate-400 mt-1">Cung cấp bởi Gemini TTS</p>
        </div>
        <div className="flex-1 flex items-center justify-end space-x-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
              title="API Keys"
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
              value={textFileContent}
              onChange={(e) => setTextFileContent(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200 min-h-[200px]"
              placeholder="Dán hoặc gõ văn bản của bạn trực tiếp vào đây..."
              disabled={isDisabled}
            />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-[--color-primary-300] mb-3 transition-colors">2. Tùy chọn Giọng đọc</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="language-select" className="block text-sm font-medium text-slate-400 mb-2">Ngôn ngữ</label>
                    <select
                        id="language-select"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        disabled={isDisabled}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200"
                        aria-label="Chọn ngôn ngữ"
                    >
                        <option value="vietnam">Việt Nam</option>
                        <option value="other">Quốc tế</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="region-select" className="block text-sm font-medium text-slate-400 mb-2">Vùng miền</label>
                    <select
                    id="region-select"
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    disabled={isDisabled || selectedLanguage !== 'vietnam'}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Chọn vùng miền"
                    >
                    <option value="bac">Miền Bắc</option>
                    <option value="trung">Miền Trung</option>
                    <option value="nam">Miền Nam</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="voice-select" className="block text-sm font-medium text-slate-400 mb-2">Giọng đọc cụ thể</label>
                    <div className="flex items-center space-x-2">
                      <select
                      id="voice-select"
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      disabled={isDisabled}
                      className="flex-grow bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200"
                      aria-label="Chọn giọng đọc"
                      >
                      {voiceOptions.map(voice => (
                          <option key={voice.id} value={voice.id}>{voice.name}</option>
                      ))}
                      </select>
                       <button
                          onClick={handlePreviewVoice}
                          disabled={isDisabled}
                          className="flex-shrink-0 p-3 rounded-lg bg-slate-700 hover:bg-[--color-primary-600]/50 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                          title="Nghe thử giọng đọc đã chọn"
                          aria-label="Nghe thử giọng đọc đã chọn"
                      >
                          {isPreviewLoading 
                              ? <SpinnerIcon hasMargin={false} />
                              : <PlayIcon />
                          }
                      </button>
                    </div>
                </div>
            </div>
            {selectedLanguage === 'vietnam' ? (
              <p className="text-xs text-slate-500 pt-4 text-center">
                Lưu ý: Tính năng chọn giọng theo vùng miền là thử nghiệm và kết quả có thể không hoàn hảo.
              </p>
            ) : (
              <p className="text-xs text-slate-500 pt-4 text-center">
                Tool sẽ tự động nhận diện ngôn ngữ bạn nhập vào.
              </p>
            )}
          </div>


          <div>
            <h2 className="text-xl font-semibold text-[--color-primary-300] mb-3 transition-colors">3. Tạo âm thanh</h2>
             <button
              onClick={handleGenerateAudio}
              disabled={isDisabled || !textFileContent}
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
            {audioResults.length > 0 && !isLoading && (
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
          
          {isLoading && (
             <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                <SpinnerIcon hasMargin={false} />
                <p className="mt-4">Đang tạo âm thanh, vui lòng đợi...</p>
                <p className="text-sm text-slate-500">Quá trình này có thể mất một lúc đối với các văn bản dài.</p>
            </div>
          )}

          {!isLoading && audioResults.length === 0 && !error && (
            <div className="flex items-center justify-center text-slate-500 h-64">
              {apiKeys.length === 0 ? 'Vui lòng thêm API key để bắt đầu.' : 'Các clip âm thanh sẽ xuất hiện ở đây sau khi được tạo.'}
            </div>
          )}

          {audioResults.length > 0 && (
            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 results-scrollbar">
              {audioResults.map((result) => (
                <AudioPlayer key={result.id} result={result} />
              ))}
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
        onSetActiveKey={handleSetActiveKey}
      />
    </div>
  );
};

export default App;

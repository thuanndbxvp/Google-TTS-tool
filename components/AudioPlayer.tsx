

import React from 'react';
import type { AudioResult } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';

interface AudioPlayerProps {
  result: AudioResult;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ result }) => {
  return (
    <div className="bg-slate-700/50 p-4 rounded-lg shadow-md transition-all duration-300 hover:bg-slate-700 hover:shadow-lg hover:shadow-[--color-primary-700]/20">
      <p className="text-slate-300 mb-3 text-sm italic">"{result.text}"</p>
      <div className="flex items-center justify-between">
        <audio controls src={result.audioUrl} className="w-full max-w-xs h-10">
          Trình duyệt của bạn không hỗ trợ phần tử âm thanh.
        </audio>
        <a
          href={result.audioUrl}
          download={`segment_${result.id + 1}.wav`}
          className="ml-4 flex items-center justify-center bg-[--color-primary-700] hover:bg-[--color-primary-600] text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
          title="Tải về file WAV"
        >
          <DownloadIcon />
          <span>Tải về</span>
        </a>
      </div>
    </div>
  );
};
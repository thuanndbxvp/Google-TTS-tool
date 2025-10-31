
import React from 'react';
import type { AudioResult } from '../types';

interface AudioPlayerProps {
  result: AudioResult;
}

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);


export const AudioPlayer: React.FC<AudioPlayerProps> = ({ result }) => {
  return (
    <div className="bg-slate-700/50 p-4 rounded-lg shadow-md transition-all duration-300 hover:bg-slate-700">
      <p className="text-slate-300 mb-3 text-sm italic">"{result.text}"</p>
      <div className="flex items-center justify-between">
        <audio controls src={result.audioUrl} className="w-full max-w-xs h-10">
          Your browser does not support the audio element.
        </audio>
        <a
          href={result.audioUrl}
          download={`segment_${result.id + 1}.wav`}
          className="ml-4 flex items-center justify-center bg-cyan-700 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
          title="Download WAV"
        >
          <DownloadIcon />
          <span>Download</span>
        </a>
      </div>
    </div>
  );
};

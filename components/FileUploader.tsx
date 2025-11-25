import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelected, isProcessing }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isProcessing) return;
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelected(e.dataTransfer.files[0]);
      }
    },
    [onFileSelected, isProcessing]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors duration-200 ease-in-out ${
        isProcessing
          ? 'border-gray-300 bg-gray-50 cursor-wait'
          : 'border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 cursor-pointer'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className={`p-4 rounded-full ${isProcessing ? 'bg-gray-200' : 'bg-blue-200'}`}>
            {isProcessing ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            ) : (
                <Upload className="w-8 h-8 text-blue-600" />
            )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-700">
            {isProcessing ? 'Processando arquivo...' : 'Arraste sua planilha aqui'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Suporta .xlsx, .csv ou .ods
          </p>
        </div>
        <label className="relative">
          <span className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}>
            Selecionar Arquivo
          </span>
          <input
            type="file"
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            accept=".xlsx,.xls,.csv,.ods"
            onChange={handleChange}
            disabled={isProcessing}
          />
        </label>
      </div>
    </div>
  );
};

export default FileUploader;
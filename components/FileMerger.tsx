import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, Merge, AlertCircle, Download, CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { mergeFiles, downloadFile } from '../services/timesheetService';
import { ViewType } from '../App';

interface FileMergerProps {
    onTransfer: (file: File, target: ViewType) => void;
}

const FileMerger: React.FC<FileMergerProps> = ({ onTransfer }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Result State
  const [mergedFile, setMergedFile] = useState<File | null>(null);
  const [mergedCount, setMergedCount] = useState<number>(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setError(null);
      setMergedFile(null); // Reset previous result
      const newFiles = Array.from(e.target.files);
      
      setFiles(prev => {
        const combined = [...prev, ...newFiles];
        if (combined.length > 5) {
            setError("Máximo de 5 arquivos permitidos.");
            return combined.slice(0, 5);
        }
        return combined;
      });
    }
    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setMergedFile(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
        setError("Selecione pelo menos 2 arquivos para unir.");
        return;
    }
    setIsMerging(true);
    setError(null);
    try {
        const result = await mergeFiles(files);
        setMergedFile(result.file);
        setMergedCount(result.count);
    } catch (e) {
        console.error(e);
        setError("Erro ao unir arquivos. Verifique se são planilhas válidas.");
    } finally {
        setIsMerging(false);
    }
  };

  const handleDownload = () => {
    if (mergedFile) downloadFile(mergedFile);
  };

  const handleContinueMerging = () => {
    if (mergedFile) {
        setFiles([mergedFile]);
        setMergedFile(null);
        setMergedCount(0);
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="animate-fade-in">
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl mx-auto border border-gray-200">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Merge className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Unificar Planilhas</h2>
                <p className="text-gray-500 mt-2">Junte até 5 arquivos em uma única tabela Excel mantendo todos os dados.</p>
            </div>

            {!mergedFile ? (
                <>
                    {/* Drop Zone Area */}
                    <div className="group border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl p-8 text-center bg-purple-50/50 hover:bg-purple-50 transition-all relative mb-8 cursor-pointer">
                        <input 
                            type="file" 
                            multiple 
                            accept=".xlsx,.xls,.csv,.ods"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={handleFileSelect}
                            disabled={isMerging}
                        />
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-purple-900">Clique para adicionar arquivos</p>
                                <p className="text-sm text-purple-600/70 mt-1">Suporta .xlsx, .csv (Max 5)</p>
                            </div>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-3 mb-8">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1">Arquivos Selecionados ({files.length}/5)</h3>
                            {files.map((file, idx) => (
                                <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="bg-green-100 p-2 rounded-lg">
                                            <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                        </div>
                                        <span className="text-gray-700 font-medium truncate">{file.name}</span>
                                        <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <button 
                                        onClick={() => removeFile(idx)} 
                                        className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                        disabled={isMerging}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleMerge}
                        disabled={files.length < 2 || isMerging}
                        className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                            files.length < 2 || isMerging 
                            ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transform hover:-translate-y-1'
                        }`}
                    >
                        {isMerging ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Processando...
                            </>
                        ) : (
                            <>
                                <Merge className="w-5 h-5" />
                                Unificar Arquivos
                            </>
                        )}
                    </button>
                </>
            ) : (
                <div className="bg-green-50 rounded-xl border border-green-100 p-6 animate-fade-in">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-green-800">Sucesso!</h3>
                        <p className="text-green-700 mt-1">
                            Unificação concluída. Total de registros: <span className="font-bold">{mergedCount}</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                         <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 bg-white border border-green-200 text-green-700 hover:bg-green-50 py-3 rounded-lg font-semibold shadow-sm transition-colors"
                        >
                            <Download className="w-5 h-5" />
                            Baixar Planilha Unificada
                        </button>

                        <button
                            onClick={handleContinueMerging}
                            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold shadow-sm transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Continuar Unificando (Usar como base)
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-green-200"></div>
                            <span className="flex-shrink-0 mx-4 text-green-600 text-xs uppercase font-bold">Ou enviar para</span>
                            <div className="flex-grow border-t border-green-200"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => onTransfer(mergedFile, 'PROCESSOR')}
                                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow-md transition-colors"
                            >
                                <div className="text-left">
                                    <div className="text-xs opacity-80 uppercase">Tratamento</div>
                                    <div className="flex items-center gap-1">
                                        De Ponto <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </button>
                            <button
                                onClick={() => onTransfer(mergedFile, 'DAILY')}
                                className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold shadow-md transition-colors"
                            >
                                <div className="text-left">
                                    <div className="text-xs opacity-80 uppercase">Análise</div>
                                    <div className="flex items-center gap-1">
                                        De Diaristas <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => { setMergedFile(null); setFiles([]); }}
                        className="mt-6 w-full text-center text-gray-400 hover:text-gray-600 text-sm underline"
                    >
                        Começar novo processo do zero
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default FileMerger;
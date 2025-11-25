import React, { useState } from 'react';
import { Upload, FileSearch, ArrowRight, CheckCircle2, AlertTriangle, Download, X, Eye, Calculator, UserSquare2, RefreshCw } from 'lucide-react';
import { processInformationIntersection, exportIntersectionExcel, generateExcelFile } from '../services/timesheetService';
import { ViewType } from '../App';

interface InformationAnalyzerProps {
    onTransfer?: (file: File, target: ViewType) => void;
}

const InformationAnalyzer: React.FC<InformationAnalyzerProps> = ({ onTransfer }) => {
    const [file1, setFile1] = useState<File | null>(null);
    const [file2, setFile2] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Result now stores the generated file as well
    const [result, setResult] = useState<{ count: number, totalBefore: number, data: any[], generatedFile: File | null } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleProcess = async () => {
        if (!file1 || !file2) {
            setError("Por favor, selecione as duas planilhas.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        
        try {
            // Delay for UI feedback
            setTimeout(async () => {
                try {
                    const { filteredData, initialCount, finalCount } = await processInformationIntersection(file1, file2);
                    
                    // Generate a File object from the filtered data to allow transfer
                    const newFile = generateExcelFile(filteredData, `Filtrado_${file1.name}`);

                    setResult({
                        data: filteredData,
                        count: finalCount,
                        totalBefore: initialCount,
                        generatedFile: newFile
                    });
                } catch (err) {
                    console.error(err);
                    setError("Erro ao processar as planilhas. Verifique se ambas possuem colunas de identificação de nomes.");
                } finally {
                    setIsProcessing(false);
                }
            }, 500);
        } catch (e) {
            setIsProcessing(false);
            setError("Erro inesperado.");
        }
    };

    const handleDownload = () => {
        if (result && result.data.length > 0) {
            exportIntersectionExcel(result.data);
        }
    };

    const handleTransfer = (target: ViewType) => {
        if (onTransfer && result?.generatedFile) {
            onTransfer(result.generatedFile, target);
        }
    };

    const handleReuseAsInput = () => {
        if (result?.generatedFile) {
            setFile1(result.generatedFile);
            setFile2(null);
            setResult(null);
            setError(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 border border-gray-200">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
                        <FileSearch className="w-8 h-8 text-teal-600" />
                        Cruzamento de Dados
                    </h2>
                    <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
                        Selecione duas planilhas. O sistema irá manter na <strong>Planilha 1</strong> apenas os registros cujos nomes também apareçam na <strong>Planilha 2</strong>.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative">
                    {/* File 1 Input */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                            Planilha 1 (Principal/Alvo)
                        </label>
                        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${file1 ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400'}`}>
                            {file1 ? (
                                <div className="flex flex-col items-center">
                                    <div className="bg-teal-100 p-2 rounded-full mb-2">
                                        <CheckCircle2 className="w-6 h-6 text-teal-600" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-800 break-all">{file1.name}</span>
                                    <button onClick={() => setFile1(null)} className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1">
                                        <X className="w-3 h-3" /> Remover
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-600">Clique para selecionar</span>
                                    <input type="file" className="hidden" accept=".xlsx,.csv,.xls" onChange={(e) => handleFileChange(e, setFile1)} />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Arrow Icon in Desktop */}
                    <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
                        <div className="bg-white p-2 rounded-full shadow-sm border">
                            <ArrowRight className="w-6 h-6 text-gray-400" />
                        </div>
                    </div>

                    {/* File 2 Input */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                            Planilha 2 (Filtro/Referência)
                        </label>
                        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${file2 ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400'}`}>
                            {file2 ? (
                                <div className="flex flex-col items-center">
                                    <div className="bg-teal-100 p-2 rounded-full mb-2">
                                        <CheckCircle2 className="w-6 h-6 text-teal-600" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-800 break-all">{file2.name}</span>
                                    <button onClick={() => setFile2(null)} className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1">
                                        <X className="w-3 h-3" /> Remover
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-600">Clique para selecionar</span>
                                    <input type="file" className="hidden" accept=".xlsx,.csv,.xls" onChange={(e) => handleFileChange(e, setFile2)} />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 justify-center">
                        <AlertTriangle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleProcess}
                        disabled={!file1 || !file2 || isProcessing}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                            !file1 || !file2 || isProcessing
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-teal-600 hover:bg-teal-700 hover:-translate-y-0.5'
                        }`}
                    >
                        {isProcessing ? 'Processando...' : 'Comparar e Filtrar'}
                    </button>
                </div>
            </div>

            {result && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 shadow-sm animate-fade-in">
                    <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-teal-800 mb-2">Processamento Concluído</h3>
                        <p className="text-teal-700">
                            De <strong>{result.totalBefore}</strong> registros originais, <strong>{result.count}</strong> foram mantidos (nomes encontrados na Planilha 2).
                        </p>
                    </div>

                    {/* PREVIEW TABLE */}
                    {result.data.length > 0 && (
                        <div className="mb-6 bg-white rounded-lg border border-teal-100 overflow-hidden shadow-sm">
                            <div className="bg-teal-100 px-4 py-2 flex items-center gap-2 text-teal-800 font-semibold text-sm">
                                <Eye className="w-4 h-4" /> Pré-visualização (5 primeiros registros)
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            {Object.keys(result.data[0]).slice(0, 5).map(key => (
                                                <th key={key} className="px-4 py-2 whitespace-nowrap">{key}</th>
                                            ))}
                                            {Object.keys(result.data[0]).length > 5 && <th className="px-4 py-2">...</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {result.data.slice(0, 5).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                {Object.values(row).slice(0, 5).map((val: any, vIdx) => (
                                                    <td key={vIdx} className="px-4 py-2 whitespace-nowrap text-gray-600">
                                                        {val instanceof Date ? val.toLocaleDateString() : String(val)}
                                                    </td>
                                                ))}
                                                {Object.keys(row).length > 5 && <td className="px-4 py-2 text-gray-400">...</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-teal-600 text-teal-700 hover:bg-teal-600 hover:text-white px-6 py-3 rounded-lg font-bold transition-all"
                        >
                            <Download className="w-5 h-5" />
                            Baixar Resultado Filtrado
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-teal-200">
                            {onTransfer && (
                                <>
                                    <button
                                        onClick={() => handleTransfer('PROCESSOR')}
                                        className="flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-3 rounded-lg font-medium shadow-sm transition-colors text-xs md:text-sm text-center"
                                    >
                                        <Calculator className="w-5 h-5 mb-1" />
                                        <span>Tratamento de Ponto</span>
                                    </button>
                                    <button
                                        onClick={() => handleTransfer('DAILY')}
                                        className="flex flex-col items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-3 rounded-lg font-medium shadow-sm transition-colors text-xs md:text-sm text-center"
                                    >
                                        <UserSquare2 className="w-5 h-5 mb-1" />
                                        <span>Análise de Diaristas</span>
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleReuseAsInput}
                                className="flex flex-col items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-3 py-3 rounded-lg font-medium shadow-sm transition-colors text-xs md:text-sm text-center"
                            >
                                <RefreshCw className="w-5 h-5 mb-1" />
                                <span>Novo Cruzamento</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InformationAnalyzer;
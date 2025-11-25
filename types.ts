export interface RawRecord {
  Pessoa: string;
  DataHora: Date; // Consolidated Date/Time object
  Grupo?: string;
  OriginalRow: any; // To keep other data if needed
}

export interface ProcessedShift {
  id: string;
  person: string;
  date: string; // YYYY-MM-DD of the shift start
  startTime: Date;
  lunchStart: Date | null;
  lunchEnd: Date | null;
  endTime: Date;
  workedHours: number;
  workedTimeStr: string; // HH:MM:SS format
  lunchType: 'NORMAL' | 'EXTENDED_CAPPED' | 'ARTIFICIAL' | 'NONE';
  warnings: string[];
}

export interface DailyWorkerRecord {
  id: string;
  nome: string;
  cpf: string;
  data: string; // YYYY-MM-DD
  chegada: Date;
  saida: Date;
  horaTotal: string; // HH:MM:SS
  categoria: string;
  grupo: string;
}

export interface ProcessingConfig {
  shiftThresholdHours: number; // Default 5 (was 12)
  lunchMinDuration: number; // Default 45 min
  lunchMaxDuration: number; // Default 75 min
  defaultLunchDuration: number; // Default 60 min
}
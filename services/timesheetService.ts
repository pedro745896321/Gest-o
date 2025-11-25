import { read, utils, write, WorkBook, WorkSheet } from 'xlsx';
import { RawRecord, ProcessedShift, ProcessingConfig, DailyWorkerRecord } from '../types';

export const DEFAULT_CONFIG: ProcessingConfig = {
  shiftThresholdHours: 8, // Increased to 8h to better support shifts without lunch punches while respecting 11h inter-shift gap
  lunchMinDuration: 45, // minutes
  lunchMaxDuration: 75, // minutes
  defaultLunchDuration: 60, // minutes
};

// Helper to format Date to YYYY-MM-DD HH:mm:ss
export const formatDateFull = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Helper to format Date to YYYY-MM-DD
export const formatDateOnly = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Helper to format Duration MS to HH:MM:SS
export const formatDuration = (ms: number): string => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

// Helper for setting specific time on a date
const setDateTime = (baseDate: Date, hours: number, minutes: number): Date => {
    const newDate = new Date(baseDate);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
};

// Helper to determine the target Lunch Window based on Shift Start Time
const getLunchWindow = (shiftStart: Date): { start: Date, end: Date } => {
    const startHour = shiftStart.getHours();
    let windowStart: Date;
    let windowEnd: Date;

    if (startHour >= 5 && startHour < 13) {
        // MORNING SHIFT: Window 10:30 - 14:30
        windowStart = setDateTime(shiftStart, 10, 30);
        windowEnd = setDateTime(shiftStart, 14, 30);
    } else if (startHour >= 13 && startHour < 18) {
        // AFTERNOON SHIFT: Window 17:30 - 20:00
        windowStart = setDateTime(shiftStart, 17, 30);
        windowEnd = setDateTime(shiftStart, 20, 0);
    } else {
        // NIGHT SHIFT: Window 00:30 - 03:00
        // Handle date crossing. If shift started >= 18:00, the window is next day.
        const refDate = new Date(shiftStart);
        if (startHour >= 18) {
            refDate.setDate(refDate.getDate() + 1);
        }
        windowStart = setDateTime(refDate, 0, 30);
        windowEnd = setDateTime(refDate, 3, 0);
    }
    return { start: windowStart, end: windowEnd };
};

export const processTimesheetFile = async (file: File, config: ProcessingConfig = DEFAULT_CONFIG): Promise<ProcessedShift[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Use raw: true (default) to get Date objects directly, avoiding string parsing issues
        const jsonData = utils.sheet_to_json(worksheet);

        const rawRecords: RawRecord[] = parseRawData(jsonData);
        const processed = processRecords(rawRecords, config);
        resolve(processed);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

// --- NEW FUNCTION: Daily Worker Analysis ---
export const processDailyWorkers = async (file: File): Promise<DailyWorkerRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Use raw: true (default) to get Date objects directly
        const jsonData = utils.sheet_to_json(worksheet);

        const rawRecords: RawRecord[] = parseRawData(jsonData);
        const processed = calculateDailyWorkers(rawRecords);
        resolve(processed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

const calculateDailyWorkers = (records: RawRecord[]): DailyWorkerRecord[] => {
  const output: DailyWorkerRecord[] = [];
  
  const THRESHOLD_HOURS = 12;
  const MAX_SHIFT_DURATION_HOURS = 16;

  // 1. Group by Person
  const groupedByPerson = new Map<string, RawRecord[]>();
  records.forEach(r => {
    if (!groupedByPerson.has(r.Pessoa)) groupedByPerson.set(r.Pessoa, []);
    groupedByPerson.get(r.Pessoa)?.push(r);
  });

  // 2. Process each person
  groupedByPerson.forEach((personRecords, personName) => {
    // Sort chronologically
    personRecords.sort((a, b) => a.DataHora.getTime() - b.DataHora.getTime());

    let currentShiftPunches: RawRecord[] = [];

    const finalizeShift = (punches: RawRecord[]) => {
        if (punches.length === 0) return;
        
        // Use First and Last punch of the IDENTIFIED SHIFT
        const firstRecord = punches[0];
        const lastRecord = punches[punches.length - 1];
        
        const start = firstRecord.DataHora;
        const end = lastRecord.DataHora;
        let durationMs = end.getTime() - start.getTime();

        // --- INTERVAL ANALYSIS FOR DAILY WORKERS ---
        // We apply the same logic to subtract lunch break if it exists within the specific windows
        const punchDates = punches.map(p => p.DataHora);
        const gaps: { start: Date; end: Date; durationMinutes: number }[] = [];
        for (let i = 0; i < punchDates.length - 1; i++) {
          const gStart = punchDates[i];
          const gEnd = punchDates[i + 1];
          const diffMin = (gEnd.getTime() - gStart.getTime()) / (1000 * 60);
          gaps.push({ start: gStart, end: gEnd, durationMinutes: diffMin });
        }

        // Get the official window for this shift start
        const { start: windowStart, end: windowEnd } = getLunchWindow(start);

        // Find a valid gap (45-75 min) that overlaps/touches the window
        const validGap = gaps.find(g => {
             const isDurationValid = g.durationMinutes >= 45 && g.durationMinutes <= 75;
             if (!isDurationValid) return false;

             // Check intersection with window
             const overlapStart = new Date(Math.max(g.start.getTime(), windowStart.getTime()));
             const overlapEnd = new Date(Math.min(g.end.getTime(), windowEnd.getTime()));
             return overlapStart < overlapEnd; // True if they overlap
        });

        if (validGap) {
            // Subtract the break from total duration
            const breakMs = validGap.durationMinutes * 60 * 1000;
            durationMs -= breakMs;
        }
        // -------------------------------------------

        // Metadata extraction
        const originalRow = firstRecord.OriginalRow || {};
        const keys = Object.keys(originalRow);
        const findVal = (keywords: string[]) => {
          const key = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
          return key ? String(originalRow[key]).trim() : '';
        };

        const cpf = findVal(['cpf', 'documento']);
        const categoria = findVal(['categoria', 'função', 'funcao', 'cargo']);
        const grupo = firstRecord.Grupo && firstRecord.Grupo !== 'Default' 
            ? firstRecord.Grupo 
            : findVal(['grupo', 'depto', 'departamento', 'setor']);

        output.push({
            id: `${personName}-${start.getTime()}`,
            nome: personName,
            cpf: cpf,
            data: formatDateOnly(start), 
            chegada: start,
            saida: end,
            horaTotal: formatDuration(durationMs), // Calculated net hours
            categoria: categoria,
            grupo: grupo
        });
    };

    for (let i = 0; i < personRecords.length; i++) {
        const record = personRecords[i];
        
        if (currentShiftPunches.length === 0) {
            currentShiftPunches.push(record);
        } else {
            const lastRecord = currentShiftPunches[currentShiftPunches.length - 1];
            const firstInShift = currentShiftPunches[0];

            const diffHours = (record.DataHora.getTime() - lastRecord.DataHora.getTime()) / (1000 * 60 * 60);
            const totalDuration = (record.DataHora.getTime() - firstInShift.DataHora.getTime()) / (1000 * 60 * 60);

            if (diffHours <= THRESHOLD_HOURS && totalDuration <= MAX_SHIFT_DURATION_HOURS) {
                currentShiftPunches.push(record);
            } else {
                finalizeShift(currentShiftPunches);
                currentShiftPunches = [record];
            }
        }
    }
    finalizeShift(currentShiftPunches);
  });

  // Sort output: Name -> Date
  return output.sort((a, b) => {
    if (a.nome < b.nome) return -1;
    if (a.nome > b.nome) return 1;
    return new Date(a.chegada).getTime() - new Date(b.chegada).getTime();
  });
};

export const exportDailyWorkersExcel = (data: DailyWorkerRecord[]) => {
  // Match the exact columns requested: NOME, CPF, DATA, DATA/HORA CHEGADA, DATA/HORA SAÍDA, HORA TOTAL, CATEGORIA, GRUPO DE PESSOAS
  const rows = data.map(r => ({
    "NOME": r.nome,
    "CPF": r.cpf,
    "DATA": r.data, // Formatted YYYY-MM-DD in calculation
    "DATA/HORA CHEGADA": formatDateFull(r.chegada),
    "DATA/HORA SAÍDA": formatDateFull(r.saida),
    "HORA TOTAL": r.horaTotal,
    "CATEGORIA": r.categoria,
    "GRUPO DE PESSOAS": r.grupo
  }));

  const ws: WorkSheet = utils.json_to_sheet(rows);
  
  // Auto-width roughly
  ws['!cols'] = [
    { wch: 35 }, // NOME
    { wch: 15 }, // CPF
    { wch: 12 }, // DATA
    { wch: 22 }, // CHEGADA
    { wch: 22 }, // SAIDA
    { wch: 15 }, // TOTAL
    { wch: 15 }, // CATEGORIA
    { wch: 20 }, // GRUPO
  ];

  const wb: WorkBook = utils.book_new();
  utils.book_append_sheet(wb, ws, "Analise Diaristas");
  
  const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Analise_Diaristas_${new Date().getTime()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Function to merge multiple excel files and return a File object
export const mergeFiles = async (files: File[]): Promise<{ file: File, count: number }> => {
  const allRows: any[] = [];
  
  const readFile = (file: File): Promise<any[]> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const data = e.target?.result;
                  const workbook = read(data, { type: 'array' });
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  const jsonData = utils.sheet_to_json(worksheet);
                  resolve(jsonData);
              } catch (err) {
                  reject(err);
              }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
      });
  };

  try {
      const results = await Promise.all(files.map(f => readFile(f)));
      
      results.forEach(rows => {
        if (Array.isArray(rows)) {
            // FIX: Using loop instead of spread (...rows) to avoid "Maximum call stack size exceeded" on large files
            for (const row of rows) {
                allRows.push(row);
            }
        }
      });

      if (allRows.length === 0) throw new Error("Nenhum dado encontrado para mesclar.");

      const ws = utils.json_to_sheet(allRows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Unificado");
      
      const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      
      const fileName = `Unificado_${new Date().getTime()}.xlsx`;
      const file = new File([blob], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      return { file, count: allRows.length };
  } catch (error) {
      console.error("Erro no merge:", error);
      throw error;
  }
};

// Helper to trigger download of a File object
export const downloadFile = (file: File) => {
    const url = window.URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Helper to generate a File object from JSON data (for internal transfer)
export const generateExcelFile = (data: any[], fileName: string): File => {
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Dados");
    
    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    
    return new File([blob], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

// Step 1: Normalize Input Data
// Completely rewritten to scan ALL columns and support horizontal formats
const parseRawData = (jsonData: any[]): RawRecord[] => {
  const records: RawRecord[] = [];

  jsonData.forEach((row) => {
    const keys = Object.keys(row);
    
    // 1. Identify Person
    const personKey = keys.find(k => {
        const header = k.toLowerCase();
        return header.includes('pessoa') || header.includes('nome') || header.includes('funcionario') || header.includes('empregado');
    });

    // If we can't find a person, we skip the row
    if (!personKey) return;
    const personName = String(row[personKey]).trim();
    if (!personName) return;

    // Optional Group
    const groupKey = keys.find(k => k.toLowerCase().includes('grupo') || k.toLowerCase().includes('depto'));
    const group = groupKey ? String(row[groupKey]).trim() : 'Default';

    // 2. Scan ALL columns for dates
    keys.forEach(key => {
        if (key === personKey || key === groupKey) return; // Skip metadata columns

        // FILTER: Ignore columns that are obviously summaries or metadata
        const headerLower = key.toLowerCase();
        if (
            headerLower.includes('total') || 
            headerLower.includes('saldo') || 
            headerLower.includes('banco') || 
            headerLower.includes('horas') ||
            headerLower.includes('hrs') || 
            headerLower.includes('trab') || 
            headerLower.includes('obs')
        ) {
            return;
        }

        const val = row[key];
        let dateVal: Date | null = null;

        // Check if value is a valid Date object (from cellDates: true)
        if (val instanceof Date) {
             dateVal = val;
        } 
        // Fallback for strings if something wasn't parsed automatically
        else if (typeof val === 'string' && val.length > 8) {
             const parsed = new Date(val);
             if (!isNaN(parsed.getTime())) {
                 dateVal = parsed;
             }
        }

        if (dateVal) {
            // 3. Filter out Reference Dates (Midnight 00:00:00)
            // Often report rows have a "Date" column and multiple "Time" columns.
            const isMidnight = dateVal.getHours() === 0 && dateVal.getMinutes() === 0 && dateVal.getSeconds() === 0;
            
            // 4. Filter out Invalid Years (Excel Durations often parse to 1899 or 1900)
            // Also ignores years way in the past which are likely errors
            const isInvalidYear = dateVal.getFullYear() < 2020;

            if (!isMidnight && !isInvalidYear) {
                records.push({
                    Pessoa: personName,
                    DataHora: dateVal,
                    Grupo: group,
                    OriginalRow: row,
                });
            }
        }
    });
  });

  // Sort by Person, then by Date/Time
  // This linearizes horizontal data (Entry, Lunch, Exit in one row) into a vertical stream
  return records.sort((a, b) => {
    if (a.Pessoa < b.Pessoa) return -1;
    if (a.Pessoa > b.Pessoa) return 1;
    return a.DataHora.getTime() - b.DataHora.getTime();
  });
};

// Step 2: Group and Calculate Logic
const processRecords = (records: RawRecord[], config: ProcessingConfig): ProcessedShift[] => {
  const shifts: ProcessedShift[] = [];
  const groupedByPerson = new Map<string, RawRecord[]>();

  // Group by Person
  records.forEach(r => {
    if (!groupedByPerson.has(r.Pessoa)) groupedByPerson.set(r.Pessoa, []);
    groupedByPerson.get(r.Pessoa)?.push(r);
  });

  // Process each person
  groupedByPerson.forEach((personRecords, personName) => {
    if (personRecords.length === 0) return;

    let currentShiftPunches: Date[] = [];

    for (let i = 0; i < personRecords.length; i++) {
      const punch = personRecords[i].DataHora;

      if (currentShiftPunches.length === 0) {
        currentShiftPunches.push(punch);
      } else {
        const firstPunchInShift = currentShiftPunches[0];
        const lastPunch = currentShiftPunches[currentShiftPunches.length - 1];
        
        const diffHours = (punch.getTime() - lastPunch.getTime()) / (1000 * 60 * 60);
        const totalDurationHours = (punch.getTime() - firstPunchInShift.getTime()) / (1000 * 60 * 60);

        // Logic update:
        // 1. Gap must be <= threshold (8h default)
        // 2. Total shift duration must be <= 18h (safety lock, reduced from 24h to avoid day merging)
        if (diffHours <= config.shiftThresholdHours && totalDurationHours <= 18) {
          currentShiftPunches.push(punch);
        } else {
          // Finalize previous shift
          shifts.push(calculateSingleShift(personName, currentShiftPunches, config));
          // Start new shift
          currentShiftPunches = [punch];
        }
      }
    }

    // Finalize last shift
    if (currentShiftPunches.length > 0) {
      shifts.push(calculateSingleShift(personName, currentShiftPunches, config));
    }
  });

  // Final Sort: Person, then Date
  return shifts.sort((a, b) => {
    if (a.person < b.person) return -1;
    if (a.person > b.person) return 1;
    return a.startTime.getTime() - b.startTime.getTime();
  });
};

// Step 3: Individual Shift Calculation (Lunch Logic)
const calculateSingleShift = (person: string, punches: Date[], config: ProcessingConfig): ProcessedShift => {
  const start = punches[0];
  const end = punches[punches.length - 1];
  const shiftDurationMs = end.getTime() - start.getTime();

  // Unique ID for React keys
  const id = `${person}-${start.getTime()}`;

  let lunchStart: Date | null = null;
  let lunchEnd: Date | null = null;
  let lunchType: ProcessedShift['lunchType'] = 'NONE';

  // If single punch or very short duration, assume incomplete/no lunch
  if (punches.length < 2 || shiftDurationMs < 1000 * 60 * 60) {
    return {
      id,
      person,
      date: formatDateOnly(start),
      startTime: start,
      endTime: end,
      lunchStart: null,
      lunchEnd: null,
      workedHours: shiftDurationMs / (1000 * 60 * 60),
      workedTimeStr: formatDuration(shiftDurationMs),
      lunchType: 'NONE',
      warnings: ['Turno com registro único ou muito curto'],
    };
  }

  // Find gaps
  const gaps: { start: Date; end: Date; durationMinutes: number }[] = [];
  for (let i = 0; i < punches.length - 1; i++) {
    const gStart = punches[i];
    const gEnd = punches[i + 1];
    const diffMin = (gEnd.getTime() - gStart.getTime()) / (1000 * 60);
    gaps.push({ start: gStart, end: gEnd, durationMinutes: diffMin });
  }

  // --- REVISED LUNCH ANALYSIS LOGIC ---
  // 1. Get Target Window
  const { start: windowStart, end: windowEnd } = getLunchWindow(start);

  // 2. Filter Gaps: Must be 45-75 min AND overlap or be close to the window
  const validGaps = gaps.filter(g => g.durationMinutes >= config.lunchMinDuration && g.durationMinutes <= config.lunchMaxDuration);
  
  let standardLunch = null;
  
  if (validGaps.length === 1) {
      standardLunch = validGaps[0];
  } else if (validGaps.length > 1) {
      // If multiple valid gaps, prioritize the one strictly INSIDE the target window
      const insideWindow = validGaps.filter(g => {
          return g.start >= windowStart && g.end <= windowEnd;
      });

      if (insideWindow.length > 0) {
          standardLunch = insideWindow[0];
      } else {
          // Fallback: Pick closest to the middle of the WINDOW
          const windowMid = (windowStart.getTime() + windowEnd.getTime()) / 2;
          standardLunch = validGaps.sort((a, b) => {
            const midA = a.start.getTime() + (a.durationMinutes * 60 * 1000 / 2);
            const midB = b.start.getTime() + (b.durationMinutes * 60 * 1000 / 2);
            return Math.abs(midA - windowMid) - Math.abs(midB - windowMid);
          })[0];
      }
  }

  if (standardLunch) {
    lunchStart = standardLunch.start;
    lunchEnd = standardLunch.end;
    lunchType = 'NORMAL';
  } else {
    // --- ARTIFICIAL LUNCH LOGIC ---
    // Generate within the strict window
    const artificialMin = 60 + Math.floor(Math.random() * 6); 
    const artificialMs = artificialMin * 60 * 1000;

    // Calculate the Intersection of [ShiftStart, ShiftEnd] and [WindowStart, WindowEnd]
    // We add a small buffer (15 min) to ShiftStart/End to assume they don't arrive and immediately eat
    const safeShiftStart = new Date(start.getTime() + 15 * 60000);
    const safeShiftEnd = new Date(end.getTime() - 15 * 60000);

    // The valid period to start lunch is the overlap
    const validPeriodStart = new Date(Math.max(safeShiftStart.getTime(), windowStart.getTime()));
    const validPeriodEnd = new Date(Math.min(safeShiftEnd.getTime(), windowEnd.getTime()));

    // Check if there is enough room for the artificial break
    const availableTime = validPeriodEnd.getTime() - validPeriodStart.getTime();

    if (availableTime >= artificialMs) {
            // Place the break randomly within the available window
            const maxOffset = availableTime - artificialMs;
            const randomOffset = Math.floor(Math.random() * maxOffset);
            
            lunchStart = new Date(validPeriodStart.getTime() + randomOffset);
            lunchEnd = new Date(lunchStart.getTime() + artificialMs);
            lunchType = 'ARTIFICIAL';
    }
  }

  // Calculate Final Worked Hours using formula: (Início Almoço - Entrada) + (Saída - Fim Almoço)
  let workedMs = 0;
  if (lunchStart && lunchEnd) {
      // Formula requested: (Início Almoço - Entrada) + (Saída - Fim Almoço)
      const firstPart = lunchStart.getTime() - start.getTime();
      const secondPart = end.getTime() - lunchEnd.getTime();
      workedMs = firstPart + secondPart;
  } else {
      workedMs = end.getTime() - start.getTime();
  }

  if (workedMs < 0) workedMs = 0; // Safety clip

  return {
    id,
    person,
    date: formatDateOnly(start),
    startTime: start,
    endTime: end,
    lunchStart,
    lunchEnd,
    workedHours: parseFloat((workedMs / (1000 * 60 * 60)).toFixed(2)),
    workedTimeStr: formatDuration(workedMs),
    lunchType,
    warnings: [],
  };
};

// Step 4: Export to Excel
export const exportToExcel = (data: ProcessedShift[]) => {
  const rows = data.map(shift => ({
    "Pessoa": shift.person,
    "Data": shift.date,
    "Primeira Hora": formatDateFull(shift.startTime),
    "Início Almoço/Janta": shift.lunchStart ? formatDateFull(shift.lunchStart) : '', 
    "Fim Almoço/Janta": shift.lunchEnd ? formatDateFull(shift.lunchEnd) : '', 
    "Saída": formatDateFull(shift.endTime),
    "Horas Trabalhadas": shift.workedTimeStr, 
  }));

  const ws: WorkSheet = utils.json_to_sheet(rows);
  
  // Set column widths
  const wscols = [
    { wch: 30 }, // Pessoa
    { wch: 12 }, // Data
    { wch: 20 }, // Primeira Hora
    { wch: 20 }, // Início Almoço
    { wch: 20 }, // Fim Almoço
    { wch: 20 }, // Saída
    { wch: 15 }, // Horas
  ];
  ws['!cols'] = wscols;

  const wb: WorkBook = utils.book_new();
  utils.book_append_sheet(wb, ws, "Ponto Tratado");
  
  const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  
  const fileName = `Tratada_${new Date().getTime()}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Helper function to sort shifts: 
// Shifts with workedHours <= 1 are pushed to the bottom.
// Otherwise, original order (Person/Date) is preserved.
const sortShortShiftsToBottom = (a: ProcessedShift, b: ProcessedShift) => {
    const isAShort = a.workedHours <= 1;
    const isBShort = b.workedHours <= 1;

    // If A is short (<=1h) and B is not, A goes after B (return 1)
    if (isAShort && !isBShort) return 1;
    
    // If B is short (<=1h) and A is not, B goes after A (return -1)
    if (!isAShort && isBShort) return -1;

    // If both are the same category (both short or both normal), preserve original order
    return 0;
};

// Step 5: Export Shifts Separate by Time (Turno)
export const exportShiftsByCategory = (data: ProcessedShift[]) => {
  const morning: ProcessedShift[] = [];
  const afternoon: ProcessedShift[] = [];
  const night: ProcessedShift[] = [];

  // 1. Separate by category
  data.forEach(shift => {
      const startHour = shift.startTime.getHours();
      
      // Morning: 05:00 - 12:59
      if (startHour >= 5 && startHour < 13) {
          morning.push(shift);
      } 
      // Afternoon: 13:00 - 17:59 (Changed to start night shift earlier at 18:00)
      else if (startHour >= 13 && startHour < 18) {
          afternoon.push(shift);
      } 
      // Night: 18:00 - 04:59
      else {
          night.push(shift);
      }
  });

  // 2. Sort: Move shifts <= 1h to the bottom
  morning.sort(sortShortShiftsToBottom);
  afternoon.sort(sortShortShiftsToBottom);
  night.sort(sortShortShiftsToBottom);

  // 3. Convert to Row Object
  const createRow = (shift: ProcessedShift) => ({
      "Pessoa": shift.person,
      "Data": shift.date,
      "Início": formatDateFull(shift.startTime),
      "Início Almoço/Janta": shift.lunchStart ? formatDateFull(shift.lunchStart) : '',
      "Fim Almoço/Janta": shift.lunchEnd ? formatDateFull(shift.lunchEnd) : '',
      "Fim": formatDateFull(shift.endTime),
      "Horas": shift.workedTimeStr
  });

  const wb: WorkBook = utils.book_new();
  
  // Helper to append sheet with auto-width
  const append = (name: string, shifts: ProcessedShift[]) => {
      const rows = shifts.length > 0 
          ? shifts.map(createRow) 
          : [{"Info": "Nenhum registro encontrado para este turno"}];
          
      const ws = utils.json_to_sheet(rows);
      // Adjusted width for extra columns
      ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
      utils.book_append_sheet(wb, ws, name);
  };

  append("Manhã", morning);
  append("Tarde", afternoon);
  append("Noite", night);

  const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Turnos_Separados_${new Date().getTime()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportSingleSheet = (data: ProcessedShift[], sheetName: string, fileName: string) => {
  // Create a copy and sort: shifts <= 1h go to the bottom
  const sortedData = [...data].sort(sortShortShiftsToBottom);

  const rows = sortedData.map(shift => ({
    "Pessoa": shift.person,
    "Data": shift.date,
    "Início": formatDateFull(shift.startTime),
    "Início Almoço/Janta": shift.lunchStart ? formatDateFull(shift.lunchStart) : '',
    "Fim Almoço/Janta": shift.lunchEnd ? formatDateFull(shift.lunchEnd) : '',
    "Fim": formatDateFull(shift.endTime),
    "Horas": shift.workedTimeStr
  }));

  const ws: WorkSheet = utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
  
  const wb: WorkBook = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  
  const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

// --- INTERSECTION / INFORMATION CROSS-CHECK LOGIC ---

export const processInformationIntersection = async (file1: File, file2: File): Promise<{ filteredData: any[], initialCount: number, finalCount: number }> => {
    // 1. Helper to read a generic excel file
    const readFile = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    // 2. Helper to find the "Name" column value in a row, regardless of header name
    const getNameFromRow = (row: any): string | null => {
        const keys = Object.keys(row);
        const nameKey = keys.find(k => {
            const h = k.toLowerCase();
            return h.includes('nome') || h.includes('pessoa') || h.includes('funcionario') || h.includes('empregado') || h.includes('colaborador');
        });
        if (nameKey && row[nameKey]) {
            return String(row[nameKey]).trim().toLowerCase();
        }
        return null;
    };

    const [data1, data2] = await Promise.all([readFile(file1), readFile(file2)]);

    if (!Array.isArray(data1) || !Array.isArray(data2)) {
        throw new Error("Formato de arquivo inválido.");
    }

    // 3. Build a whitelist Set from File 2
    const whitelist = new Set<string>();
    data2.forEach(row => {
        const name = getNameFromRow(row);
        if (name) whitelist.add(name);
    });

    // 4. Filter File 1
    const filteredData = data1.filter(row => {
        const name = getNameFromRow(row);
        return name && whitelist.has(name);
    });

    return {
        filteredData,
        initialCount: data1.length,
        finalCount: filteredData.length
    };
};

export const exportIntersectionExcel = (data: any[]) => {
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Filtrado");
    
    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cruzamento_Informacoes_${new Date().getTime()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};
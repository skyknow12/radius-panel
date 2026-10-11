'use client';

import React from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  ShieldAlert,
  Calendar,
  Layers,
  RefreshCw,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function CustomerImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: CustomerImportModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [fileName, setFileName] = React.useState<string>('');
  const [allowAuthException, setAllowAuthException] = React.useState<boolean>(false);
  const [preferredDateFormat, setPreferredDateFormat] = React.useState<'auto' | 'DMY' | 'MDY' | 'YMD'>('auto');
  const [parsedRows, setParsedRows] = React.useState<any[]>([]);
  const [previewResult, setPreviewResult] = React.useState<{
    total: number;
    validCount: number;
    invalidCount: number;
    rows: any[];
    errors: any[];
  } | null>(null);

  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [importSummary, setImportSummary] = React.useState<{
    success: boolean;
    importedCount: number;
    failedCount: number;
    failedRows: any[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Reset state when closed
  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setFileName('');
      setParsedRows([]);
      setPreviewResult(null);
      setImportSummary(null);
      setErrorMessage(null);
      setAllowAuthException(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Simple, robust CSV string parser
  const parseCSV = (text: string): any[] => {
    // Strip BOM
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = '';
        if (char === '\r' && cleanText[i + 1] === '\n') i++;
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) lines.push(currentLine);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let curVal = '';
      let quotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (quotes && line[i + 1] === '"') {
            curVal += '"';
            i++;
          } else {
            quotes = !quotes;
          }
        } else if (c === ',' && !quotes) {
          values.push(curVal.trim());
          curVal = '';
        } else {
          curVal += c;
        }
      }
      values.push(curVal.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, '_'));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (vals.every((v) => !v)) continue; // skip blank lines
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
      });
      rows.push(rowObj);
    }

    return rows;
  };

  // Dynamic Excel parser loader (SheetJS)
  const parseExcelFile = async (fileBlob: File): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        let XLSX: any = (window as any).XLSX;
        if (!XLSX) {
          // Load dynamically from script tag if not yet in window
          await new Promise<void>((res, rej) => {
            const existingScript = document.getElementById('sheetjs-script');
            if (existingScript) {
              existingScript.addEventListener('load', () => res());
              return;
            }
            const script = document.createElement('script');
            script.id = 'sheetjs-script';
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onload = () => res();
            script.onerror = () => rej(new Error('Failed to load Excel reader library. Please use CSV file.'));
            document.head.appendChild(script);
          });
          XLSX = (window as any).XLSX;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            resolve(json);
          } catch (err: any) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(fileBlob);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setErrorMessage(null);
    setPreviewResult(null);
    setImportSummary(null);

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');

    try {
      setLoadingPreview(true);
      let rows: any[] = [];
      if (isExcel) {
        rows = await parseExcelFile(selectedFile);
      } else {
        const text = await selectedFile.text();
        rows = parseCSV(text);
      }

      if (rows.length === 0) {
        setErrorMessage('The uploaded file is empty or missing data rows.');
        return;
      }

      setParsedRows(rows);
      await runValidationPreview(rows, allowAuthException, preferredDateFormat);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file. Ensure it is a valid CSV or Excel file.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const runValidationPreview = async (
    rows: any[],
    authException: boolean,
    dateFormat: 'auto' | 'DMY' | 'MDY' | 'YMD'
  ) => {
    try {
      setLoadingPreview(true);
      setErrorMessage(null);
      const res = await fetch('/api/subscribers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          allowAuthException: authException,
          preferredDateFormat: dateFormat,
          commit: false,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.error || 'Failed to validate customer rows');
      }

      setPreviewResult(json.data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAuthExceptionToggle = (val: boolean) => {
    setAllowAuthException(val);
    if (parsedRows.length > 0) {
      runValidationPreview(parsedRows, val, preferredDateFormat);
    }
  };

  const handleDateFormatChange = (val: 'auto' | 'DMY' | 'MDY' | 'YMD') => {
    setPreferredDateFormat(val);
    if (parsedRows.length > 0) {
      runValidationPreview(parsedRows, allowAuthException, val);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await fetch('/api/subscribers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          allowAuthException,
          preferredDateFormat,
          commit: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.error || 'Failed to complete customer bulk import');
      }

      setImportSummary(json.data);
      onImportComplete();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent =
      'username,password,full_name,email,phone,address,area,package,expiry_date,branch,reseller,mac_address,connection_type\n' +
      'john_doe,pass1234,John Doe,john@example.com,9841000001,Kathmandu,Baneshwor,Basic 50Mbps,2026-12-31,Head Office,,00:11:22:33:44:55,PPPoE\n' +
      'jane_smith,,Jane Smith,jane@example.com,9841000002,Lalitpur,Patan,Premium 100Mbps,31/12/2026,Head Office,,,PPPoE\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'radius_customer_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadFailedRowsCSV = () => {
    if (!importSummary?.failedRows || importSummary.failedRows.length === 0) return;
    const failedRows = importSummary.failedRows;
    const keys = Object.keys(failedRows[0]);
    const headerRow = keys.join(',');
    const dataRows = failedRows.map((row) =>
      keys
        .map((k) => {
          const v = String(row[k] ?? '');
          return v.includes(',') || v.includes('"') || v.includes('\n')
            ? `"${v.replace(/"/g, '""')}"`
            : v;
        })
        .join(',')
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `failed_customers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Bulk Customer Import</h2>
              <p className="text-xs text-muted-foreground">
                Import subscribers from Excel (.xlsx) or CSV with validation preview and FreeRADIUS synchronization.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Import Success Summary */}
          {importSummary && (
            <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Import Execution Completed</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Rows</span>
                  <span className="text-lg font-black text-foreground">{importSummary.importedCount + importSummary.failedCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase block">Successfully Imported</span>
                  <span className="text-lg font-black text-emerald-400">{importSummary.importedCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-rose-400 font-semibold uppercase block">Failed / Skipped</span>
                  <span className="text-lg font-black text-rose-400">{importSummary.failedCount}</span>
                </div>
              </div>

              {importSummary.failedCount > 0 && (
                <div className="pt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Some rows failed validation or contained errors. You can download the failed rows file with detailed error messages.
                  </p>
                  <button
                    onClick={downloadFailedRowsCSV}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Failed Rows (CSV)
                  </button>
                </div>
              )}
            </div>
          )}

          {!importSummary && (
            <>
              {/* File Upload Box & Template Downloads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center transition-colors relative bg-muted/10">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {fileName ? fileName : 'Choose CSV or Excel (.xlsx) File'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drag & drop or browse from your computer. Max 10,000 customers per batch.
                    </p>
                  </div>
                </div>

                <div className="border border-border rounded-2xl p-4 bg-card/60 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground block mb-1">Standard Templates</span>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Download the formatted template containing standard columns and example data.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={downloadCSVTemplate}
                      className="w-full px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-primary" /> Download CSV Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Import Options & Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border rounded-2xl p-4 bg-card/40">
                {/* Date Format Option */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Expiry Date Format Disambiguation
                  </label>
                  <select
                    value={preferredDateFormat}
                    onChange={(e) => handleDateFormatChange(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="auto">Auto-Detect (Safe Ambiguity Handling)</option>
                    <option value="DMY">DD/MM/YYYY (Day / Month / Year - South Asia/UK)</option>
                    <option value="MDY">MM/DD/YYYY (Month / Day / Year - US)</option>
                    <option value="YMD">YYYY-MM-DD (ISO 8601 Standard)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Used to disambiguate ambiguous dates like 05/11/2026. Excel serial dates (e.g. 45200) are auto-converted.
                  </p>
                </div>

                {/* Password-Bypass Authentication Exception Checkbox */}
                <div className="flex flex-col justify-center">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowAuthException}
                      onChange={(e) => handleAuthExceptionToggle(e.target.checked)}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-foreground block flex items-center gap-1">
                        Temporary Authentication Exception
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Optional
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        Permit imported customers to authenticate via PPPoE/Hotspot without initial password verification (Auth-Type := Accept). Password column becomes optional. Automatically revoked upon password update.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Validation Preview Table */}
              {loadingPreview && (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span>Validating customer data against database...</span>
                </div>
              )}

              {previewResult && !loadingPreview && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">Validation Preview</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        {previewResult.total} Total Rows
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {previewResult.validCount} Valid
                      </span>
                      {previewResult.invalidCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {previewResult.invalidCount} Invalid
                        </span>
                      )}
                    </div>
                    {previewResult.invalidCount > 0 && (
                      <span className="text-[11px] text-rose-400">
                        Invalid rows will be skipped during batch import.
                      </span>
                    )}
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Username</th>
                          <th className="py-2.5 px-3">Full Name</th>
                          <th className="py-2.5 px-3">Package</th>
                          <th className="py-2.5 px-3">Expiry Date</th>
                          <th className="py-2.5 px-3">Branch/Reseller</th>
                          <th className="py-2.5 px-3">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewResult.rows.map((r, i) => (
                          <tr key={i} className={r.valid ? 'hover:bg-muted/30' : 'bg-rose-500/5'}>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{r.rowNumber}</td>
                            <td className="py-2.5 px-3">
                              {r.valid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
                                    <XCircle className="w-3 h-3" /> Error
                                  </span>
                                  <div className="text-[10px] text-rose-400/90 leading-tight">
                                    {r.errors.join('; ')}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-foreground">{r.username}</td>
                            <td className="py-2.5 px-3">{r.fullName}</td>
                            <td className="py-2.5 px-3 font-semibold text-primary">{r.packageName}</td>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{r.expiryDate || 'N/A'}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {r.branchName || r.resellerName || 'Head Office'}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{r.phone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            {importSummary ? 'Close' : 'Cancel'}
          </button>

          {!importSummary && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={submitting || !previewResult || previewResult.validCount === 0}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Customers...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Commit Import ({previewResult ? previewResult.validCount : 0} Customers)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

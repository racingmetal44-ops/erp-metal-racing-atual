import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Copy,
  ClipboardPaste,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  FileSpreadsheet,
  Save
} from 'lucide-react';

import { supabase } from '../lib/supabase';

const DEFAULT_ROWS = 18;
const DEFAULT_COLS = 10;

function createCell(value = '') {
  return {
    value,
    style: {
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left'
    }
  };
}

function createSheet(name, rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => createCell('')))
  };
}

function cloneSheet(sheet) {
  return {
    ...sheet,
    cells: sheet.cells.map((row) => row.map((cell) => ({ ...cell, style: { ...cell.style } })))
  };
}

function colLabel(index) {
  let label = '';
  let value = index;
  while (value >= 0) {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

function parseCoordinate(reference) {
  const match = reference.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number(match[2]) - 1, col: col - 1 };
}

function getCellValue(sheet, rowIndex, colIndex) {
  const cell = sheet.cells[rowIndex]?.[colIndex];
  if (!cell) return '';

  if (typeof cell.value === 'string' && cell.value.startsWith('=')) {
    const expression = cell.value.slice(1).trim();
    const sumMatch = expression.match(/^SUM\(([^)]+)\)$/i);
    if (sumMatch) {
      const range = sumMatch[1].split(':');
      const start = parseCoordinate(range[0]);
      const end = parseCoordinate(range[1]);
      if (start && end) {
        let total = 0;
        for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r += 1) {
          for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c += 1) {
            const value = getCellValue(sheet, r, c);
            const numeric = Number(value);
            if (!Number.isNaN(numeric)) total += numeric;
          }
        }
        return total;
      }
    }

    const expressionWithRefs = expression.replace(/([A-Za-z]+\d+)/g, (reference) => {
      const coord = parseCoordinate(reference);
      if (!coord) return reference;
      const resolved = getCellValue(sheet, coord.row, coord.col);
      return typeof resolved === 'number' ? resolved : 0;
    });

    try {
      const result = Function(`"use strict"; return (${expressionWithRefs})`)();
      return Number.isFinite(result) ? result : '';
    } catch (error) {
      return '';
    }
  }

  if (typeof cell.value === 'string' && /^-?\d+(\.\d+)?$/.test(cell.value.trim())) {
    return Number(cell.value);
  }

  return cell.value;
}

export default function SpreadsheetsPage() {
  const [sheets, setSheets] = useState([createSheet('Planilha 1')]);
  const [activeSheetId, setActiveSheetId] = useState(sheets[0]?.id);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [selection, setSelection] = useState(null); // { start: {row,col}, end: {row,col} }
  const [isSelecting, setIsSelecting] = useState(false);
  const [clipboard, setClipboard] = useState(null);
  const [history, setHistory] = useState([sheets.map(cloneSheet)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];

  const ownerKey = 'erp_spreadsheets_owner';
  const autosaveTimer = useRef(null);
  const [message, setMessage] = useState('');

  async function loadFromSupabase() {
    try {
      setMessage('Carregando planilhas...');
      let owner = window.localStorage.getItem(ownerKey);
      if (!owner) {
        setMessage('Nenhuma configuração encontrada localmente.');
        return;
      }
      const { data, error } = await supabase
        .from('spreadsheets')
        .select('id,owner,payload,updated_at')
        .eq('owner', owner)
        .single();
      if (error && error.code !== 'PGRST116') {
        setMessage('Erro ao buscar dados: ' + error.message);
        return;
      }
      if (data && data.payload) {
        const payload = data.payload;
        if (Array.isArray(payload)) {
          setSheets(payload.map(cloneSheet));
          setActiveSheetId(payload[0]?.id);
          setMessage('Planilhas carregadas do Supabase.');
          return;
        }
      }
      setMessage('Nenhuma planilha salva no Supabase para este dispositivo.');
    } catch (err) {
      setMessage('Erro ao carregar: ' + err.message);
    }
  }

  async function saveToSupabase() {
    try {
      setMessage('Salvando planilhas...');
      let owner = window.localStorage.getItem(ownerKey);
      if (!owner) {
        owner = `owner_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        window.localStorage.setItem(ownerKey, owner);
      }
      const payload = sheets.map(cloneSheet);
      // try update
      const { data: existing } = await supabase.from('spreadsheets').select('id').eq('owner', owner).single();
      if (existing && existing.id) {
        const { error } = await supabase.from('spreadsheets').update({ payload }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('spreadsheets').insert({ owner, payload });
        if (error) throw error;
      }
      setMessage('Planilhas salvas no Supabase.');
    } catch (err) {
      setMessage('Erro ao salvar: ' + err.message);
    }
  }

  // autosave on sheets change (debounced)
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveToSupabase();
    }, 3500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [sheets]);

  function commitSheets(nextSheets, shouldTrack = true) {
    setSheets(nextSheets);
    if (!shouldTrack) return;
    const snapshot = nextSheets.map(cloneSheet);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, snapshot];
    });
    setHistoryIndex(historyIndex + 1);
  }

  function normalizeSelection(sel) {
    if (!sel) return null;
    const startRow = Math.min(sel.start.row, sel.end.row);
    const endRow = Math.max(sel.start.row, sel.end.row);
    const startCol = Math.min(sel.start.col, sel.end.col);
    const endCol = Math.max(sel.start.col, sel.end.col);
    return { start: { row: startRow, col: startCol }, end: { row: endRow, col: endCol } };
  }

  function isCellInSelection(row, col) {
    const sel = normalizeSelection(selection);
    if (!sel) return false;
    return row >= sel.start.row && row <= sel.end.row && col >= sel.start.col && col <= sel.end.col;
  }

  function updateActiveSheet(updater) {
    if (!activeSheet) return;
    const nextSheets = sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      return updater(cloneSheet(sheet));
    });
    commitSheets(nextSheets);
  }

  function addSheet() {
    const nextName = `Planilha ${sheets.length + 1}`;
    const nextSheets = [...sheets, createSheet(nextName)];
    setSheets(nextSheets);
    setActiveSheetId(nextSheets[nextSheets.length - 1].id);
    setSelectedCell({ row: 0, col: 0 });
    setHistory((prev) => [...prev, nextSheets.map(cloneSheet)]);
    setHistoryIndex(historyIndex + 1);
  }

  function removeActiveSheet() {
    if (sheets.length === 1) return;
    const filtered = sheets.filter((sheet) => sheet.id !== activeSheetId);
    const nextActive = filtered[0];
    setSheets(filtered);
    setActiveSheetId(nextActive.id);
    setSelectedCell({ row: 0, col: 0 });
  }

  function addRow() {
    updateActiveSheet((sheet) => {
      const nextCells = [...sheet.cells, Array.from({ length: sheet.cols }, () => createCell(''))];
      return { ...sheet, rows: sheet.rows + 1, cells: nextCells };
    });
  }

  function addColumn() {
    updateActiveSheet((sheet) => {
      const nextCells = sheet.cells.map((row) => [...row, createCell('')]);
      return { ...sheet, cols: sheet.cols + 1, cells: nextCells };
    });
  }

  function applyStyle(change) {
    if (!activeSheet) return;
    updateActiveSheet((sheet) => {
      const nextCells = sheet.cells.map((row) => row.map((cell) => cell));
      const cell = nextCells[selectedCell.row]?.[selectedCell.col];
      if (cell) {
        cell.style = { ...cell.style, ...change };
      }
      return { ...sheet, cells: nextCells };
    });
  }

  function updateCellValue(value) {
    if (!activeSheet) return;
    updateActiveSheet((sheet) => {
      const nextCells = sheet.cells.map((row) => row.map((cell) => cell));
      const cell = nextCells[selectedCell.row]?.[selectedCell.col];
      if (cell) {
        cell.value = value;
      }
      return { ...sheet, cells: nextCells };
    });
  }

  function clearCell() {
    updateCellValue('');
  }

  function copySelection() {
    if (!activeSheet) return;
    const sel = normalizeSelection(selection ?? { start: selectedCell, end: selectedCell });
    const rows = [];
    for (let r = sel.start.row; r <= sel.end.row; r += 1) {
      const cols = [];
      for (let c = sel.start.col; c <= sel.end.col; c += 1) {
        const cell = activeSheet.cells[r]?.[c] || createCell('');
        cols.push({ value: cell.value, style: { ...cell.style } });
      }
      rows.push(cols);
    }
    setClipboard({ rows, height: rows.length, width: rows[0]?.length || 0 });
  }

  function cutSelection() {
    copySelection();
    clearCell();
  }

  function pasteSelection() {
    if (!clipboard || !activeSheet) return;
    const start = selection ? normalizeSelection(selection).start : selectedCell;
    updateActiveSheet((sheet) => {
      const nextCells = sheet.cells.map((row) => row.map((cell) => cell));
      for (let r = 0; r < clipboard.height; r += 1) {
        for (let c = 0; c < clipboard.width; c += 1) {
          const targetR = start.row + r;
          const targetC = start.col + c;
          if (!nextCells[targetR]) continue;
          if (!nextCells[targetR][targetC]) continue;
          const source = clipboard.rows[r][c];
          nextCells[targetR][targetC].value = source.value;
          nextCells[targetR][targetC].style = { ...nextCells[targetR][targetC].style, ...source.style };
        }
      }
      return { ...sheet, cells: nextCells };
    });
  }

  useEffect(() => {
    function onMouseUp() {
      setIsSelecting(false);
    }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  function startSelection(row, col, e) {
    setIsSelecting(true);
    const start = { row, col };
    setSelection({ start, end: start });
    setSelectedCell({ row, col });
    if (e && e.shiftKey) {
      // extend from previous selectedCell
      const prev = selectedCell || { row: 0, col: 0 };
      setSelection({ start: prev, end: { row, col } });
    }
  }

  function extendSelection(row, col) {
    if (!isSelecting) return;
    setSelection((prev) => {
      if (!prev) return { start: { row, col }, end: { row, col } };
      return { start: prev.start, end: { row, col } };
    });
    setSelectedCell({ row, col });
  }

  function clickCell(row, col, e) {
    if (e.shiftKey) {
      const prev = selectedCell || { row: 0, col: 0 };
      setSelection({ start: prev, end: { row, col } });
      setSelectedCell({ row, col });
      return;
    }
    setSelection(null);
    setSelectedCell({ row, col });
  }

  function undo() {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      const previous = history[nextIndex];
      setHistoryIndex(nextIndex);
      setSheets(previous.map(cloneSheet));
      setActiveSheetId(previous[0]?.id || activeSheetId);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const next = history[nextIndex];
      setHistoryIndex(nextIndex);
      setSheets(next.map(cloneSheet));
      setActiveSheetId(next[0]?.id || activeSheetId);
    }
  }

  function renameActiveSheet() {
    const nextName = window.prompt('Novo nome da planilha', activeSheet?.name || '');
    if (!nextName) return;
    updateActiveSheet((sheet) => ({ ...sheet, name: nextName }));
  }

  function exportCsv() {
    if (!activeSheet) return;
    const rows = activeSheet.cells.map((row) => row.map((cell) => `${getCellValue(activeSheet, row.index ?? 0, 0)}`));
    const csv = rows.map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSheet.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        cutSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSheet, selectedCell, clipboard, history, historyIndex]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Planilhas</p>
        <h1 className="mt-2 text-3xl font-semibold">Planilhas interativas</h1>
        <p className="mt-2 text-sm text-slate-400">Crie vérias planilhas, edite células, aplique estilos e use atalhos semelhantes ao Excel.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addSheet} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Plus size={14} className="mr-2 inline" /> Nova planilha
          </button>
          <button onClick={addRow} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">+ Linha</button>
          <button onClick={addColumn} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">+ Coluna</button>
          <button onClick={() => applyStyle({ fontWeight: 'bold' })} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Bold size={14} className="mr-2 inline" /> Negrito
          </button>
          <button onClick={() => applyStyle({ fontStyle: 'italic' })} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Italic size={14} className="mr-2 inline" /> Itálico
          </button>
          <button onClick={() => applyStyle({ textDecoration: 'underline' })} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Underline size={14} className="mr-2 inline" /> Sublinhado
          </button>
          <button onClick={() => applyStyle({ textAlign: 'left' })} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <AlignLeft size={14} className="mr-2 inline" /> Esquerda
          </button>
          <button onClick={() => applyStyle({ textAlign: 'center' })} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <AlignCenter size={14} className="mr-2 inline" /> Centro
          </button>
          <button onClick={() => applyStyle({ textAlign: 'right' })} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <AlignRight size={14} className="mr-2 inline" /> Direita
          </button>
          <button onClick={copySelection} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Copy size={14} className="mr-2 inline" /> Copiar
          </button>
          <button onClick={pasteSelection} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <ClipboardPaste size={14} className="mr-2 inline" /> Colar
          </button>
          <button onClick={undo} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Undo2 size={14} className="mr-2 inline" /> Desfazer
          </button>
          <button onClick={redo} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Redo2 size={14} className="mr-2 inline" /> Refazer
          </button>
          <button onClick={renameActiveSheet} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <FileSpreadsheet size={14} className="mr-2 inline" /> Renomear
          </button>
          <button onClick={exportCsv} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
            <Save size={14} className="mr-2 inline" /> Exportar CSV
          </button>
          <button onClick={removeActiveSheet} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            <Trash2 size={14} className="mr-2 inline" /> Excluir aba
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            onClick={() => {
              setActiveSheetId(sheet.id);
              setSelectedCell({ row: 0, col: 0 });
            }}
            className={`rounded-full border px-3 py-2 text-sm ${sheet.id === activeSheetId ? 'border-orange-500 bg-orange-500/15 text-orange-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}
          >
            {sheet.name}
          </button>
        ))}
      </div>

      {activeSheet && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{activeSheet.name}</p>
              <p className="text-xs text-slate-400">Use Ctrl/Cmd + C, V, X, Z e Y para copiar, colar, desfazer e refazer.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">Célula selecionada: {colLabel(selectedCell.col)}{selectedCell.row + 1}</div>
              <button onClick={() => void saveToSupabase()} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white">
                <Save size={12} className="mr-2 inline" /> Salvar
              </button>
              <button onClick={() => void loadFromSupabase()} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white">
                <Save size={12} className="mr-2 inline" /> Carregar
              </button>
              <div className="text-xs text-slate-400">{message}</div>
            </div>
          </div>

          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-12 border border-slate-800 bg-slate-900/80 p-2 text-slate-500"></th>
                {Array.from({ length: activeSheet.cols }).map((_, colIndex) => (
                  <th key={colIndex} className="min-w-[90px] border border-slate-800 bg-slate-900/80 p-2 text-center text-slate-400">
                    {colLabel(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.cells.map((row, rowIndex) => (
                <tr key={`${activeSheet.id}-${rowIndex}`}>
                  <td className="border border-slate-800 bg-slate-900/80 px-2 py-2 text-center text-xs text-slate-500">{rowIndex + 1}</td>
                  {row.map((cell, colIndex) => {
                    const isSelected = selectedCell.row === rowIndex && selectedCell.col === colIndex;
                    const cellValue = activeSheet.cells[rowIndex][colIndex].value;
                    const displayedValue = typeof cellValue === 'string' && cellValue.startsWith('=')
                      ? getCellValue(activeSheet, rowIndex, colIndex)
                      : cellValue;

                    const isEditing = selectedCell.row === rowIndex && selectedCell.col === colIndex;
                    const rawValue = activeSheet.cells[rowIndex][colIndex].value;
                    const displayed = isEditing
                      ? (rawValue ?? '')
                      : (typeof rawValue === 'string' && rawValue.startsWith('=') ? String(getCellValue(activeSheet, rowIndex, colIndex)) : String(rawValue ?? ''));

                    return (
                      <td key={`${activeSheet.id}-${rowIndex}-${colIndex}`} className="border border-slate-800 bg-slate-950/50 p-0">
                        <input
                          value={displayed}
                          onFocus={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                          onMouseDown={(e) => { startSelection(rowIndex, colIndex, e); }}
                          onMouseEnter={(e) => { if (e.buttons === 1 || isSelecting) extendSelection(rowIndex, colIndex); }}
                          onClick={(e) => clickCell(rowIndex, colIndex, e)}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            updateActiveSheet((sheet) => {
                              const nextCells = sheet.cells.map((sheetRow) => sheetRow.map((sheetCell) => sheetCell));
                              const target = nextCells[rowIndex]?.[colIndex];
                              if (target) target.value = nextValue;
                              return { ...sheet, cells: nextCells };
                            });
                          }}
                          className={`h-10 w-full bg-transparent px-2 text-sm outline-none ${isSelected || isCellInSelection(rowIndex, colIndex) ? 'ring-1 ring-orange-500' : ''}`}
                          style={{
                            fontWeight: cell.style.fontWeight,
                            fontStyle: cell.style.fontStyle,
                            textDecoration: cell.style.textDecoration,
                            textAlign: cell.style.textAlign,
                            background: isCellInSelection(rowIndex, colIndex) ? 'rgba(249,115,22,0.06)' : undefined
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

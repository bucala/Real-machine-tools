import { useEffect, useRef, useState } from 'react';
import { L } from '../core/i18n';
import './machineDownload.css';

export function MachineDownload({ apiRef, disabled, className = 'btn' }) {
  const dialog = useRef(null),
    task = useRef(null);
  const [format, setFormat] = useState('obj'),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState('');
  useEffect(() => () => task.current?.abort(), []);
  const close = () => {
    task.current?.abort();
    task.current = null;
    dialog.current.close();
    setBusy(false);
  };
  const save = async () => {
    if (task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setNote('');
    try {
      const { exportMachineModel, modelFilename } = await import('../core/machineExport');
      if (controller.signal.aborted) return;
      const model = apiRef.current.machineModel;
      if (!model?.root) throw new Error(L('Model stroja sa ešte načítava.', 'The machine model is still loading.'));
      const blob = await exportMachineModel(model, format, controller.signal);
      if (!blob) throw new Error(L('Nie je dostupná geometria na export.', 'No geometry is available to export.'));
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `${modelFilename(model.name)}-model.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNote(L('Model je pripravený na stiahnutie.', 'The model is ready to download.'));
    } catch (error) {
      if (!controller.signal.aborted)
        setNote(
          L(
            'Export sa nepodaril. Skús ho zopakovať alebo vyber iný formát.',
            'Export failed. Try again or choose another format.',
          ) + ` ${error.message}`,
        );
    } finally {
      if (task.current === controller) {
        task.current = null;
        setBusy(false);
      }
    }
  };
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => {
          setNote('');
          dialog.current.showModal();
        }}
        title={
          disabled ? L('Najprv sa vráť z pohľadu na obrobok.', 'Return from the workpiece view first.') : undefined
        }
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </svg>
        {L('Stiahnuť model', 'Download model')}
      </button>
      <dialog
        ref={dialog}
        className="machine-download"
        aria-labelledby="machine-download-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="machine-download-title" className="font-bold text-lg">
            {L('3D model stroja', 'Machine 3D model')}
          </h2>
          <button type="button" className="btn" onClick={close} aria-label={L('Zavrieť export', 'Close export')}>
            ×
          </button>
        </div>
        <p className="text-sm muted mb-3">
          {L(
            'Stiahne aktuálnu polohu stroja a viditeľné príslušenstvo, bez obrobku a podlahy. Rozmery sú v milimetroch.',
            'Downloads the current machine pose and visible accessories, without the workpiece or floor. Dimensions are in millimetres.',
          )}
        </p>
        <label className="block text-sm font-semibold mb-2" htmlFor="machine-download-format">
          {L('Formát súboru', 'File format')}
        </label>
        <select
          id="machine-download-format"
          className="sel"
          value={format}
          disabled={busy}
          onChange={(e) => {
            setFormat(e.target.value);
            setNote('');
          }}
        >
          <option value="obj">OBJ</option>
          <option value="stp">STEP / STP</option>
          <option value="stl">STL</option>
        </select>
        <p className="text-xs muted mt-2">
          {format === 'stp'
            ? L(
                'Ploškový CAD model zo simulátora, bez parametrickej histórie. Detailný stroj môže vytvoriť veľký súbor.',
                'Faceted CAD geometry from the simulator, without parametric history. A detailed machine may produce a large file.',
              )
            : format === 'obj'
              ? L(
                  'Samostatne pomenované diely na ďalšie modelovanie. Exportuje geometriu bez textúr.',
                  'Separately named parts for further modelling. Exports geometry without textures.',
                )
              : L(
                  'Trojuholníková sieť celého stroja v jednom súbore.',
                  'A triangle mesh of the entire machine in one file.',
                )}
        </p>
        <p role="status" className="text-sm mt-3" aria-live="polite">
          {busy ? L('Pripravujem model…', 'Preparing model…') : note}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn" onClick={close}>
            {busy ? L('Zrušiť export', 'Cancel export') : L('Zavrieť', 'Close')}
          </button>
          <button type="button" className="btn active" disabled={busy} onClick={save}>
            {L('Stiahnuť', 'Download')} {format.toUpperCase()}
          </button>
        </div>
      </dialog>
    </>
  );
}

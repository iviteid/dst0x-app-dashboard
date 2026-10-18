import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Cpu, FileUp, Radio, ShieldAlert, UploadCloud } from "lucide-react";
import type { Device } from "./types";
import { farmName } from "./data";

type Run = { id: string; at: string; model: string; version: string; targets: string[]; packageName: string; sha256: string };
const historyKey = "agrivaid-ota-history";
function savedRuns(): Run[] {
  try { return JSON.parse(localStorage.getItem(historyKey) || "[]"); }
  catch { return []; }
}
const reason = (device: Device, version: string) => {
  if (device.status === "offline") return "Offline";
  if (device.battery != null && device.battery < 40) return "Battery below 40%";
  if (device.firmware === version.trim()) return "Already on this version";
  return "Ready";
};

export default function FirmwareOta({ devices, farm, refresh }: { devices: Device[]; farm: string; refresh: () => void }) {
  const inScope = devices.filter((d) => farm === "all" || d.farmId === farm);
  const models = [...new Set(inScope.map((d) => d.model))].sort();
  const [model, setModel] = useState("");
  const activeModel = models.includes(model) ? model : models[0] || "";
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sha, setSha] = useState("");
  const [fileError, setFileError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<Run[]>(savedRuns);
  const [done, setDone] = useState(false);
  const candidates = inScope.filter((d) => d.model === activeModel);
  const eligible = candidates.filter((d) => reason(d, version) === "Ready");
  const readyIds = new Set(eligible.map((d) => d.id));
  const selectedReady = selected.filter((id) => readyIds.has(id));
  const allSelected = eligible.length > 0 && selectedReady.length === eligible.length;
  const preflight = useMemo(() => ({
    targets: selectedReady.length,
    blocked: candidates.length - eligible.length,
    package: !!file && !!sha,
    version: /^v?\d+\.\d+(\.\d+)?([-.][a-z0-9]+)?$/i.test(version.trim()),
  }), [selectedReady.length, candidates.length, eligible.length, file, sha, version]);
  const canRun = preflight.targets > 0 && preflight.package && preflight.version && acknowledged && !run;

  const pickFile = async (next: File | null) => {
    setFile(null);
    setSha("");
    setFileError("");
    setDone(false);
    if (!next) return;
    if (!/\.(bin|hex|uf2|img)$/i.test(next.name)) { setFileError("Choose a .bin, .hex, .uf2, or .img firmware file."); return; }
    if (next.size === 0 || next.size > 16 * 1024 * 1024) { setFileError("Firmware file must be between 1 byte and 16 MB for this demo."); return; }
    try {
      const digest = await crypto.subtle.digest("SHA-256", await next.arrayBuffer());
      setFile(next);
      setSha(Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2, "0")).join(""));
    } catch { setFileError("Could not read or hash this firmware file."); }
  };

  useEffect(() => {
    if (!run || progress >= 100) return;
    const timer = window.setInterval(() => setProgress((value) => Math.min(100, value + 20)), 480);
    return () => window.clearInterval(timer);
  }, [run, progress]);
  useEffect(() => {
    if (!run || progress < 100) return;
    const updated = devices.map((d) => run.targets.includes(d.id) ? { ...d, firmware: run.version } : d);
    localStorage.setItem("agrivaid-devices", JSON.stringify(updated));
    const next = [run, ...savedRuns()].slice(0, 8);
    localStorage.setItem(historyKey, JSON.stringify(next));
    setHistory(next);
    refresh();
    setRun(null);
    setDone(true);
    setAcknowledged(false);
  }, [run, progress]);

  const start = () => {
    if (!canRun || !file) return;
    setDone(false);
    setProgress(0);
    setRun({ id: `demo-${Date.now()}`, at: new Date().toISOString(), model: activeModel, version: version.trim(), targets: selectedReady, packageName: file.name, sha256: sha });
  };
  return <>
    <div className="page-head">
      <div><span className="map-eyebrow"><Radio size={14} /> DEVICE OPERATIONS</span><h1>Firmware OTA</h1><p>Review compatibility, stage a firmware file, and run a local update simulation.</p></div>
      <span className="ota-demo-chip">DEMO · No hardware connection</span>
    </div>
    <div className="ota-warning"><ShieldAlert size={21} /><div><b>Simulation only</b><span>The firmware file stays in this browser and is hashed locally. No package, command, or credential is sent to a device. Completion changes only locally stored demo firmware metadata.</span></div></div>
    <div className="ota-grid">
      <section className="card padded ota-workflow">
        <div className="ota-step"><span>01</span><div><h2>Choose firmware package</h2><p>Use a package built for one exact device model.</p></div></div>
        <div className="ota-fields">
          <label>Target model<select value={activeModel} onChange={(e) => { setModel(e.target.value); setSelected([]); setDone(false); }} disabled={!!run}>{models.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>New version<input value={version} onChange={(e) => { setVersion(e.target.value); setDone(false); }} placeholder="v2.9.0" disabled={!!run} /></label>
        </div>
        <label className="ota-upload"><FileUp size={24} /><strong>{file ? file.name : "Choose firmware file"}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB · SHA-256 calculated locally` : ".bin, .hex, .uf2, or .img · up to 16 MB"}</span><input type="file" accept=".bin,.hex,.uf2,.img" onChange={(e) => void pickFile(e.target.files?.[0] || null)} disabled={!!run} /></label>
        {fileError && <p className="error-text">{fileError}</p>}
        {sha && <div className="ota-hash"><span>SHA-256</span><code>{sha}</code></div>}
        <div className="ota-step"><span>02</span><div><h2>Select compatible devices</h2><p>Offline nodes, low batteries, and devices already on this version are blocked.</p></div></div>
        <div className="ota-select-bar"><span>{selectedReady.length} of {eligible.length} ready devices selected</span><button className="text-action" disabled={!!run || !eligible.length} onClick={() => setSelected(allSelected ? [] : eligible.map((d) => d.id))}>{allSelected ? "Clear selection" : "Select all ready"}</button></div>
        <div className="ota-devices">
          {candidates.map((device) => { const state = reason(device, version); const ready = state === "Ready"; return <label key={device.id} className={!ready ? "blocked" : ""}><input type="checkbox" checked={ready && selected.includes(device.id)} disabled={!ready || !!run} onChange={(e) => setSelected(e.target.checked ? [...selected, device.id] : selected.filter((id) => id !== device.id))} /><span className="ota-device-icon"><Cpu size={18} /></span><span className="ota-device-name"><b>{device.name}</b><small>{device.id} · {farmName(device.farmId)} · Current {device.firmware || "unknown"}</small></span><em className={ready ? "ready" : "blocked"}>{state}</em></label>; })}
          {!candidates.length && <p className="muted">No devices in this farm scope.</p>}
        </div>
        <div className="ota-step"><span>03</span><div><h2>Preflight & simulate</h2><p>Check the package and target set before changing demo state.</p></div></div>
        <div className="ota-preflight"><span><CheckCircle2 size={16} /> Model match: {activeModel || "None"}</span><span className={!preflight.version ? "needs-action" : ""}><CheckCircle2 size={16} /> Version: {preflight.version ? version : "Enter semantic version"}</span><span className={!preflight.package ? "needs-action" : ""}><CheckCircle2 size={16} /> Package: {preflight.package ? "Hashed locally" : "Choose file"}</span><span className={!preflight.targets ? "needs-action" : ""}><CheckCircle2 size={16} /> {preflight.targets} ready · {preflight.blocked} blocked</span></div>
        <label className="ota-consent"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} disabled={!!run} /> I understand this only simulates an OTA update and does not update physical devices.</label>
        <button className="btn primary ota-run" disabled={!canRun} onClick={start}><UploadCloud size={17} /> Simulate update on {selectedReady.length} device{selectedReady.length === 1 ? "" : "s"}</button>
        {run && <div className="ota-progress" role="status"><div><b>Simulating update</b><span>{progress}%</span></div><i><span style={{ width: `${progress}%` }} /></i><small>Validating package → staging → reboot check → metadata update</small></div>}
        {done && <div className="ota-success" role="status"><CheckCircle2 size={18} /> Demo update complete. Firmware labels changed in this browser only.</div>}
      </section>
      <aside className="ota-aside"><div className="card padded"><h2>Before a real rollout</h2><p>A production OTA service needs signed packages, device-model verification, authenticated command delivery, device acknowledgments, rollback, and deployment audit logs.</p><ul><li>Verify package signature and hardware revision</li><li>Check battery, signal, and maintenance window</li><li>Stage canary devices before fleet rollout</li><li>Confirm reported version after reboot</li></ul></div><div className="card padded"><h2>Recent demo runs</h2>{history.length ? <div className="ota-history">{history.map((item) => <div key={item.id}><b>{item.version} · {item.model}</b><span>{item.targets.length} device{item.targets.length === 1 ? "" : "s"} · {new Date(item.at).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}</span><small>{item.packageName}</small></div>)}</div> : <p className="muted">No simulated updates yet.</p>}</div></aside>
    </div>
  </>;
}

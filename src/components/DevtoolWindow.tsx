import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconX,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconRefresh,
  IconPower,
  IconCpu,
  IconDownload,
} from "@tabler/icons-react";
import {
  LogLevel,
  Notification,
  Request,
  StudioLockState,
  type LogRecord,
} from "../proto/cormoran/devtool/devtool";
import { useDevtool } from "../hooks/useDevtool";

interface DevtoolWindowProps {
  onClose: () => void;
}

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.LOG_LEVEL_UNSPECIFIED]: "ALL",
  [LogLevel.LOG_LEVEL_ERR]: "ERR",
  [LogLevel.LOG_LEVEL_WRN]: "WRN",
  [LogLevel.LOG_LEVEL_INF]: "INF",
  [LogLevel.LOG_LEVEL_DBG]: "DBG",
  [LogLevel.UNRECOGNIZED]: "?",
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.LOG_LEVEL_UNSPECIFIED]: "text-[var(--color-text-muted)]",
  [LogLevel.LOG_LEVEL_ERR]: "text-red-400",
  [LogLevel.LOG_LEVEL_WRN]: "text-yellow-400",
  [LogLevel.LOG_LEVEL_INF]: "text-[var(--color-electric)]",
  [LogLevel.LOG_LEVEL_DBG]: "text-[var(--color-text-muted)]",
  [LogLevel.UNRECOGNIZED]: "text-[var(--color-text-muted)]",
};

const FILTER_LEVELS = [
  { value: LogLevel.LOG_LEVEL_UNSPECIFIED, label: "ALL" },
  { value: LogLevel.LOG_LEVEL_ERR, label: "ERR" },
  { value: LogLevel.LOG_LEVEL_WRN, label: "WRN" },
  { value: LogLevel.LOG_LEVEL_INF, label: "INF" },
  { value: LogLevel.LOG_LEVEL_DBG, label: "DBG" },
];

function levelNum(level: LogLevel): number {
  switch (level) {
    case LogLevel.LOG_LEVEL_ERR:
      return 1;
    case LogLevel.LOG_LEVEL_WRN:
      return 2;
    case LogLevel.LOG_LEVEL_INF:
      return 3;
    case LogLevel.LOG_LEVEL_DBG:
      return 4;
    default:
      return 99;
  }
}

function levelLabel(level: LogLevel): string {
  return LOG_LEVEL_LABELS[level] ?? "?";
}

function levelColor(level: LogLevel): string {
  return LOG_LEVEL_COLORS[level] ?? "text-[var(--color-text-muted)]";
}

function formatRecordText(r: LogRecord): string {
  return `[${r.timestampMs}ms] <${levelLabel(r.level)}> ${r.source}: ${r.message}`;
}

const MAX_RECORDS = 2000;
const FILTER_DEBOUNCE_MS = 200;

export function DevtoolWindow({ onClose }: DevtoolWindowProps) {
  const { ready, call, subsystemIndex, zmkApp } = useDevtool();

  // --- Drag / resize state ---
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 520,
    y: window.innerHeight - 520,
  }));
  const [size, setSize] = useState({ w: 500, h: 480 });
  const dragOrigin = useRef<{
    mx: number;
    my: number;
    ox: number;
    oy: number;
  } | null>(null);
  const resizeOrigin = useRef<{
    mx: number;
    my: number;
    ow: number;
    oh: number;
  } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragOrigin.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: pos.x,
      oy: pos.y,
    };
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeOrigin.current = {
      mx: e.clientX,
      my: e.clientY,
      ow: size.w,
      oh: size.h,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragOrigin.current) {
        const dx = e.clientX - dragOrigin.current.mx;
        const dy = e.clientY - dragOrigin.current.my;
        setPos({
          x: Math.max(
            0,
            Math.min(window.innerWidth - 100, dragOrigin.current.ox + dx),
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight - 40, dragOrigin.current.oy + dy),
          ),
        });
      }
      if (resizeOrigin.current) {
        const dx = e.clientX - resizeOrigin.current.mx;
        const dy = e.clientY - resizeOrigin.current.my;
        setSize({
          w: Math.max(320, resizeOrigin.current.ow + dx),
          h: Math.max(240, resizeOrigin.current.oh + dy),
        });
      }
    };
    const onMouseUp = () => {
      dragOrigin.current = null;
      resizeOrigin.current = null;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // --- Lock state ---
  const [lockState, setLockState] = useState<StudioLockState>(
    StudioLockState.STUDIO_LOCK_STATE_UNSPECIFIED,
  );
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const refreshLockState = useCallback(async () => {
    if (!ready) return;
    try {
      const resp = await call(Request.create({ getStudioLockState: {} }));
      if (resp?.getStudioLockState) {
        setLockState(resp.getStudioLockState.state);
      }
    } catch {
      // best-effort
    }
  }, [ready, call]);

  useEffect(() => {
    void refreshLockState();
  }, [refreshLockState]);

  const toggleLock = async () => {
    if (!ready || lockBusy) return;
    setLockBusy(true);
    setLockError(null);
    const next =
      lockState === StudioLockState.STUDIO_LOCK_STATE_LOCKED
        ? StudioLockState.STUDIO_LOCK_STATE_UNLOCKED
        : StudioLockState.STUDIO_LOCK_STATE_LOCKED;
    try {
      const resp = await call(
        Request.create({ setStudioLockState: { state: next } }),
      );
      if (resp?.error) {
        setLockError(resp.error.message);
      } else if (resp?.setStudioLockState) {
        setLockState(resp.setStudioLockState.state);
      }
    } catch (err) {
      setLockError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLockBusy(false);
    }
  };

  // --- Device actions (reboot / bootloader) ---
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const runDeviceAction = async (request: Request) => {
    if (!ready || deviceBusy) return;
    setDeviceBusy(true);
    setDeviceError(null);
    try {
      const resp = await call(request);
      if (resp?.error) setDeviceError(resp.error.message);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeviceBusy(false);
    }
  };

  // --- Log streaming ---
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [droppedTotal, setDroppedTotal] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<LogLevel>(
    LogLevel.LOG_LEVEL_UNSPECIFIED,
  );
  // Raw text input — debounced into appliedFilterText before filtering.
  const [filterText, setFilterText] = useState("");
  const [appliedFilterText, setAppliedFilterText] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const callRef = useRef(call);
  const readyRef = useRef(ready);

  useEffect(() => {
    callRef.current = call;
  }, [call]);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // Debounce the text filter to avoid filtering on every keystroke.
  useEffect(() => {
    const timer = setTimeout(
      () => setAppliedFilterText(filterText),
      FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [filterText]);

  // Auto-start streaming on mount, auto-stop on unmount.
  useEffect(() => {
    if (!ready) return;

    void call(Request.create({ setLogStreaming: { enabled: true } })).catch(
      () => undefined,
    );

    return () => {
      if (readyRef.current) {
        void callRef
          .current(Request.create({ setLogStreaming: { enabled: false } }))
          .catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Subscribe to log stream notifications.
  useEffect(() => {
    if (subsystemIndex === undefined || !zmkApp) return;
    return zmkApp.onNotification({
      type: "custom",
      subsystemIndex,
      callback: (n) => {
        if (!n.payload) return;
        let parsed: ReturnType<typeof Notification.decode>;
        try {
          parsed = Notification.decode(n.payload);
        } catch {
          return;
        }
        const ls = parsed.logStream;
        if (!ls) return;
        // Append new records, dropping oldest when over the cap.
        setRecords((prev) => [...prev, ...ls.records].slice(-MAX_RECORDS));
        if (ls.droppedCount > 0) {
          setDroppedTotal((t) => t + ls.droppedCount);
        }
      },
    });
  }, [subsystemIndex, zmkApp]);

  // Auto-scroll log list to bottom.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [records]);

  const clearLogs = async () => {
    if (!ready) return;
    try {
      await call(Request.create({ clearLogs: {} }));
      setRecords([]);
      setDroppedTotal(0);
      setStreamError(null);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Failed to clear");
    }
  };

  const exportLogs = () => {
    const text = records.map(formatRecordText).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devtool-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Client-side filtered view (uses debounced text).
  const visibleRecords = records.filter((r) => {
    if (
      filterLevel !== LogLevel.LOG_LEVEL_UNSPECIFIED &&
      levelNum(r.level) > levelNum(filterLevel)
    ) {
      return false;
    }
    if (appliedFilterText) {
      const needle = appliedFilterText.toLowerCase();
      return (
        r.source.toLowerCase().includes(needle) ||
        r.message.toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const isLocked = lockState === StudioLockState.STUDIO_LOCK_STATE_LOCKED;
  const isUnlocked = lockState === StudioLockState.STUDIO_LOCK_STATE_UNLOCKED;

  return createPortal(
    <div
      className="fixed z-[9999] flex flex-col rounded-xl border border-[var(--color-border)] shadow-2xl bg-[var(--color-surface)] text-[var(--color-text)] font-mono text-xs select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        minWidth: 320,
        minHeight: 240,
      }}
    >
      {/* Title bar (drag handle) */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface-elevated)] rounded-t-xl border-b border-[var(--color-border)] cursor-grab active:cursor-grabbing flex-shrink-0"
        onMouseDown={onDragStart}
      >
        <span className="text-[var(--color-electric)] font-semibold tracking-widest uppercase text-[10px]">
          Devtool
        </span>
        <button
          className="btn-ghost p-0.5 rounded"
          onClick={onClose}
          title="Close"
        >
          <IconX size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 overflow-hidden p-2 gap-2 select-text">
        {/* Device controls: lock + reboot + bootloader */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex-shrink-0 flex-wrap">
          {/* Lock status + toggle */}
          <span className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-widest">
            Lock
          </span>
          {lockState === StudioLockState.STUDIO_LOCK_STATE_UNSPECIFIED && (
            <span className="text-[var(--color-text-muted)]">—</span>
          )}
          {isLocked && (
            <span className="flex items-center gap-1 text-yellow-400">
              <IconLock size={12} />
              <span>Locked</span>
            </span>
          )}
          {isUnlocked && (
            <span className="flex items-center gap-1 text-[var(--color-neon)]">
              <IconLockOpen size={12} />
              <span>Unlocked</span>
            </span>
          )}
          <button
            className="btn-ghost py-0.5 px-2 text-[10px] border border-[var(--color-border)] rounded"
            onClick={() => void toggleLock()}
            disabled={lockBusy || !ready}
            title={isLocked ? "Unlock Studio" : "Lock Studio"}
          >
            {lockBusy
              ? "..."
              : isLocked
                ? "Unlock"
                : isUnlocked
                  ? "Lock"
                  : "Toggle"}
          </button>
          <button
            className="btn-ghost p-0.5 rounded"
            onClick={() => void refreshLockState()}
            disabled={!ready}
            title="Refresh lock state"
          >
            <IconRefresh size={12} />
          </button>

          {/* Divider */}
          <span className="text-[var(--color-border)] select-none">│</span>

          {/* Reboot */}
          <button
            className="btn-ghost py-0.5 px-2 text-[10px] border border-[var(--color-border)] rounded flex items-center gap-1"
            onClick={() => void runDeviceAction(Request.create({ reboot: {} }))}
            disabled={deviceBusy || !ready}
            title="Reboot device"
          >
            <IconPower size={11} />
            Reboot
          </button>

          {/* Enter bootloader */}
          <button
            className="btn-ghost py-0.5 px-2 text-[10px] border border-[var(--color-border)] rounded flex items-center gap-1"
            onClick={() =>
              void runDeviceAction(Request.create({ enterBootloader: {} }))
            }
            disabled={deviceBusy || !ready}
            title="Enter bootloader (DFU mode)"
          >
            <IconCpu size={11} />
            Bootloader
          </button>

          {(lockError ?? deviceError) && (
            <span className="text-red-400 text-[10px] w-full">
              {lockError ?? deviceError}
            </span>
          )}
        </div>

        {/* Log toolbar: level filter + text filter (debounced) + export + clear */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <select
            className="select-field text-[10px] py-0.5 px-1.5 rounded"
            value={filterLevel}
            onChange={(e) => setFilterLevel(Number(e.target.value) as LogLevel)}
            style={{ paddingRight: "1.5rem", backgroundSize: "12px 12px" }}
          >
            {FILTER_LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input-field text-[10px] py-0.5 px-1.5 rounded flex-1 min-w-0"
            placeholder="filter source / message…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <button
            className="btn-ghost p-0.5 rounded flex-shrink-0"
            onClick={exportLogs}
            disabled={records.length === 0}
            title="Export logs to file"
          >
            <IconDownload size={12} />
          </button>
          <button
            className="btn-ghost p-0.5 rounded flex-shrink-0"
            onClick={() => void clearLogs()}
            disabled={!ready}
            title="Clear logs"
          >
            <IconTrash size={12} />
          </button>
        </div>

        {streamError && (
          <div className="text-red-400 text-[10px] px-1 flex-shrink-0">
            {streamError}
          </div>
        )}

        {droppedTotal > 0 && (
          <div className="text-yellow-400 text-[10px] px-1 flex-shrink-0">
            {droppedTotal} record(s) dropped (firmware buffer overflow)
          </div>
        )}

        {/* Log list */}
        <div className="flex-1 overflow-y-auto rounded bg-black/20 p-1 font-mono">
          {visibleRecords.length === 0 ? (
            <div className="text-[var(--color-text-muted)] text-[10px] p-1">
              {records.length === 0
                ? "Waiting for log records…"
                : "No records match the filter."}
            </div>
          ) : (
            visibleRecords.map((r, i) => (
              <div key={i} className="leading-4 whitespace-pre-wrap break-all">
                <span className="text-[var(--color-text-muted)]">
                  [{r.timestampMs}ms]{" "}
                </span>
                <span className={`font-semibold ${levelColor(r.level)}`}>
                  &lt;{levelLabel(r.level)}&gt;{" "}
                </span>
                <span className="text-[var(--color-electric)]">{r.source}</span>
                <span className="text-[var(--color-text-muted)]">: </span>
                <span className="text-[var(--color-text-secondary)]">
                  {r.message}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Record count hint */}
        <div className="text-[var(--color-text-muted)] text-[9px] px-1 flex-shrink-0 flex justify-between">
          <span>
            {visibleRecords.length !== records.length
              ? `${visibleRecords.length} / ${records.length} records`
              : `${records.length} records`}
          </span>
          <span>max {MAX_RECORDS}</span>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={onResizeStart}
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, var(--color-border) 50%)",
        }}
      />
    </div>,
    document.body,
  );
}

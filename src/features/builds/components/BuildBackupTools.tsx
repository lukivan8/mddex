import { useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Download, Upload } from "lucide-react";
import type { Build } from "../build.types";
import {
  exportLoadouts,
  parseLoadoutBackup,
  MAX_BACKUP_BYTES,
  type LoadoutBackup,
  type ImportResult,
} from "../build.backup";

export function BuildBackupTools({
  builds,
  disabled,
  onImport,
  onBusyChange,
}: {
  builds: Build[];
  disabled: boolean;
  onImport: (backup: LoadoutBackup) => Promise<ImportResult>;
  onBusyChange: (busy: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<LoadoutBackup>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locked = disabled || busy;
  const markBusy = (value: boolean) => {
    setBusy(value);
    onBusyChange(value);
  };
  return (
    <section className="loadout-backup" aria-label="Loadout backup">
      <p>
        Move all saved loadouts to another browser or website address. Files
        stay on your device.
      </p>
      <div className="loadout-backup-actions">
        <Button
          size="sm"
          variant="secondary"
          isDisabled={locked || !builds.length}
          onPress={() => {
            setError("");
            setMessage("");
            try {
              const text = exportLoadouts(builds);
              const url = URL.createObjectURL(
                new Blob([text], { type: "application/json" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = `mddex-loadouts-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage(`Backup downloaded: ${builds.length} loadouts.`);
            } catch {
              setError(
                "Could not create the backup. Your saved loadouts are unchanged.",
              );
            }
          }}
        >
          <Download size={14} />
          Export all loadouts
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={locked}
          onPress={() => fileInput.current?.click()}
        >
          <Upload size={14} />
          Choose backup
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Loadout backup file"
        hidden
        disabled={locked}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          markBusy(true);
          setError("");
          setMessage("");
          setPending(undefined);
          try {
            if (file.size > MAX_BACKUP_BYTES)
              throw new Error("Choose a loadout backup smaller than 10 MB.");
            setPending(parseLoadoutBackup(await file.text()));
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not read this backup.",
            );
          } finally {
            markBusy(false);
          }
        }}
      />
      {pending && (
        <div className="loadout-backup-review">
          <p>
            {pending.builds.length} loadouts ready to import, including their
            variants. Existing loadouts will stay. Conflicting loadouts are
            added as copies; unchanged ones are skipped.
          </p>
          <div className="loadout-backup-actions">
            <Button
              size="sm"
              isDisabled={locked}
              onPress={async () => {
                markBusy(true);
                setError("");
                setMessage("");
                try {
                  const result = await onImport(pending);
                  setMessage(
                    `Imported ${result.imported} loadouts. ${result.skipped} already here. ${result.copies} kept as copies.`,
                  );
                  setPending(undefined);
                } catch {
                  setError(
                    "Could not save the import. Check browser storage and try again. Your existing loadouts were not replaced.",
                  );
                } finally {
                  markBusy(false);
                }
              }}
            >
              Import {pending.builds.length} loadouts
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={locked}
              onPress={() => setPending(undefined)}
            >
              Cancel import
            </Button>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

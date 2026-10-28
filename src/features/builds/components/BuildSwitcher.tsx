import { BuildBackupTools } from "./BuildBackupTools";
import type { LoadoutBackup, ImportResult } from "../build.backup";
import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { Plus, Check, Copy, Trash2 } from "lucide-react";
import { filledSlots } from "../build.selectors";
import type { Build } from "../build.types";
export function BuildSwitcher({
  open,
  onClose,
  builds,
  activeId,
  onSwitch,
  onNew,
  onDuplicate,
  onDelete,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  builds: Build[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (backup: LoadoutBackup) => Promise<ImportResult>;
}) {
  const [deleting, setDeleting] = useState<Build>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) {
          setDeleting(undefined);
          setError("");
          onClose();
        }
      }}
    >
      <Modal.Container size="md">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {deleting ? "Delete loadout?" : "Saved loadouts"}
            </Modal.Heading>
            <Modal.CloseTrigger />
          </Modal.Header>
          <Modal.Body>
            {error && <p role="alert">{error}</p>}
            {!deleting && (
              <BuildBackupTools
                builds={builds}
                disabled={busy}
                onImport={onImport}
                onBusyChange={setBusy}
              />
            )}
            {deleting ? (
              <p>
                Delete “{deleting.name.trim() || "Untitled loadout"}”? This
                cannot be undone.
                {builds.length === 1 && " A new empty loadout will replace it."}
              </p>
            ) : (
              <div className="saved-loadouts">
                {[...builds]
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .map((build) => (
                    <div className="loadout-entry" key={build.id}>
                      <Button
                        isIconOnly
                        variant="ghost"
                        isDisabled={busy}
                        aria-label={`Duplicate ${build.name.trim() || "Untitled loadout"}`}
                        onPress={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await onDuplicate(build.id);
                            onClose();
                          } catch {
                            setError(
                              "Could not duplicate this loadout. Check browser storage and try again.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Copy size={16} />
                      </Button>
                      <Button
                        isIconOnly
                        variant="ghost"
                        isDisabled={busy}
                        aria-label={`Delete ${build.name.trim() || "Untitled loadout"}`}
                        onPress={() => {
                          setDeleting(build);
                          setError("");
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="loadout-option"
                        isDisabled={busy}
                        key={build.id}
                        onPress={() => {
                          onSwitch(build.id);
                          onClose();
                        }}
                      >
                        <span>
                          <strong>
                            {build.name.trim() || "Untitled loadout"}
                          </strong>
                          <small>
                            {filledSlots(build)} / 12 slots · Edited{" "}
                            {new Date(build.updatedAt).toLocaleDateString()}
                          </small>
                        </span>
                        {activeId === build.id && <Check size={16} />}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {deleting ? (
              <>
                <Button
                  variant="secondary"
                  isDisabled={busy}
                  onPress={() => {
                    setDeleting(undefined);
                    setError("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isDisabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    setError("");
                    const isLastLoadout = builds.length === 1;
                    try {
                      await onDelete(deleting.id);
                      setDeleting(undefined);
                      if (isLastLoadout) onClose();
                    } catch {
                      setError(
                        "Could not delete this loadout. Check browser storage and try again.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete loadout
                </Button>
              </>
            ) : (
              <Button
                isDisabled={busy}
                onPress={() => {
                  onNew();
                  onClose();
                }}
              >
                <Plus size={16} />
                New loadout
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

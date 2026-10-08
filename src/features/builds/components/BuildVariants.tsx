import { useState } from "react";
import { Button, Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { MAX_BUILD_VARIANTS, type Build } from "../build.types";
import { variantNumeral } from "../build.variants";

export function BuildVariants({
  build,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  disabled,
}: {
  build: Build;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onAdd?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const [deletingId, setDeletingId] = useState<string>();
  if (!onAdd && !build.variants?.length) return null;
  const entries = [{ id: "base", name: build.name }, ...(build.variants ?? [])];
  return (
    <div className="build-variants">
      <ToggleButtonGroup
        aria-label="Build variants"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selectedId ?? "base"]}
        isDisabled={disabled}
        onSelectionChange={(keys) => {
          const id = String([...keys][0]);
          onSelect(id === "base" ? undefined : id);
        }}
      >
        {entries.map((entry, index) => (
          <ToggleButton
            key={entry.id}
            id={entry.id}
            aria-label={`Variant ${variantNumeral(index)}${entry.name ? `: ${entry.name}` : ""}`}
          >
            <span title={entry.name || `Variant ${variantNumeral(index)}`}>
              {variantNumeral(index)}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {onAdd && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Add variant"
          isDisabled={disabled || entries.length >= MAX_BUILD_VARIANTS}
          onPress={onAdd}
        >
          <Plus size={16} />
        </Button>
      )}
      {selectedId && onRemove && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Delete variant"
          isDisabled={disabled}
          onPress={() => setDeletingId(selectedId)}
        >
          <Trash2 size={14} />
        </Button>
      )}
      <Modal.Backdrop
        isOpen={!!deletingId && deletingId === selectedId && !!onRemove}
        onOpenChange={(open) => {
          if (!open) setDeletingId(undefined);
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Delete variant?</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <p>
                Delete “
                {entries
                  .find((entry) => entry.id === deletingId)
                  ?.name.trim() ||
                  `Variant ${variantNumeral(entries.findIndex((entry) => entry.id === deletingId))}`}
                ”? Its equipment and name will be removed.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onPress={() => setDeletingId(undefined)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isDisabled={disabled}
                onPress={() => {
                  if (deletingId === selectedId) onRemove?.();
                  setDeletingId(undefined);
                }}
              >
                Delete variant
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
export function SpoilerControl({
  showAllItems,
  onChange,
  disabled,
}: {
  showAllItems: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="spoiler-control"
        isDisabled={disabled}
        aria-pressed={showAllItems}
        onPress={() => (showAllItems ? onChange(false) : setConfirm(true))}
      >
        {showAllItems ? <Eye size={14} /> : <EyeOff size={14} />}Show all items
      </Button>
      <Modal.Backdrop isOpen={confirm} onOpenChange={setConfirm}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Show every item?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              This reveals the names and artwork of items you haven’t discovered
              yet and may spoil equipment you haven’t encountered. It won’t
              change your collection.
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setConfirm(false)}>
                Keep spoiler-free
              </Button>
              <Button
                onPress={() => {
                  onChange(true);
                  setConfirm(false);
                }}
              >
                Show all items
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

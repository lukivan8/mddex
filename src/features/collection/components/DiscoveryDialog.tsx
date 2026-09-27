import { Button, Modal } from "@heroui/react";
export function DiscoveryDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Discover items as you find them</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            Enter an item’s full name in search to reveal it and add it to your
            collection. You can uncheck it afterward; it stays discovered.
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose}>Got it</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

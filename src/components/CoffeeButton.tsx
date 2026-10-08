import { Button, Modal, useOverlayState } from "@heroui/react";

const supportUrl = "https://www.buymeacoffee.com/lukivan8";
const widgetUrl =
  "https://www.buymeacoffee.com/widget/page/lukivan8?description=Support%20MDDEX&color=%23FFDD00";

export function CoffeeButton() {
  const state = useOverlayState();

  return (
    <Modal state={state}>
      <Button className="coffee-button" onPress={state.open} aria-haspopup="dialog">
        <img
          src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=%E2%98%95&slug=lukivan8&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff"
          alt="Buy me a coffee"
          height={60}
          loading="lazy"
        />
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog className="coffee-dialog">
            <Modal.Header className="coffee-dialog-header">
              <Modal.Heading>Support MDDEX</Modal.Heading>
              <Modal.CloseTrigger aria-label="Close support form" />
            </Modal.Header>
            <iframe
              className="coffee-widget"
              src={widgetUrl}
              title="Buy Me a Coffee support form"
              allow="publickey-credentials-get *; payment *"
            />
            <a
              className="coffee-page-link"
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Buy Me a Coffee in a new tab
            </a>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

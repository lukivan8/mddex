import { useRef, useState } from "react";
import { Button, Modal, useOverlayState } from "@heroui/react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import "./image-viewer.css";

export function ImageViewer({
  src,
  alt,
  title,
  width,
  height,
}: {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
}) {
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const state = useOverlayState({
    onOpenChange: (open) => {
      if (open) setZoom(1);
    },
  });
  function changeZoom(value: number) {
    const element = viewport.current;
    const x = element
      ? (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
      : 0.5;
    const y = element
      ? (element.scrollTop + element.clientHeight / 2) / element.scrollHeight
      : 0.5;
    setZoom(value);
    requestAnimationFrame(() => {
      if (element) {
        element.scrollLeft = x * element.scrollWidth - element.clientWidth / 2;
        element.scrollTop = y * element.scrollHeight - element.clientHeight / 2;
      }
    });
  }
  return (
    <Modal state={state}>
      <figure className="image-viewer-preview">
        <Button
          variant="ghost"
          className="image-viewer-trigger"
          aria-label={`View ${title}`}
          onPress={state.open}
        >
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            decoding="async"
          />
          <span className="image-viewer-hint">
            <ZoomIn size={16} aria-hidden="true" /> View map
          </span>
        </Button>
      </figure>
      <Modal.Backdrop>
        <Modal.Container size="full" className="image-viewer-container">
          <Modal.Dialog className="image-viewer-dialog">
            <Modal.Header className="image-viewer-header">
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger aria-label="Close image viewer" />
            </Modal.Header>
            <div
              className="image-viewer-toolbar"
              role="group"
              aria-label="Image zoom controls"
            >
              <Button
                isIconOnly
                variant="ghost"
                aria-label="Zoom out"
                isDisabled={zoom <= 1}
                onPress={() => changeZoom(Math.max(1, zoom - 0.5))}
              >
                <ZoomOut size={20} />
              </Button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <Button
                isIconOnly
                variant="ghost"
                aria-label="Zoom in"
                isDisabled={zoom >= 4}
                onPress={() => changeZoom(Math.min(4, zoom + 0.5))}
              >
                <ZoomIn size={20} />
              </Button>
              <Button variant="ghost" onPress={() => changeZoom(1)}>
                <Maximize size={16} aria-hidden="true" /> Fit
              </Button>
            </div>
            <div
              ref={viewport}
              className="image-viewer-viewport"
              style={{ cursor: zoom > 1 ? "grab" : "auto" }}
              onPointerDown={(event) => {
                if (
                  zoom <= 1 ||
                  event.pointerType !== "mouse" ||
                  event.button !== 0
                )
                  return;
                event.preventDefault();
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  x: event.clientX,
                  y: event.clientY,
                  left: event.currentTarget.scrollLeft,
                  top: event.currentTarget.scrollTop,
                };
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                event.currentTarget.scrollLeft =
                  drag.current.left - (event.clientX - drag.current.x);
                event.currentTarget.scrollTop =
                  drag.current.top - (event.clientY - drag.current.y);
              }}
              onPointerUp={(event) => {
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
              tabIndex={0}
              role="region"
              aria-label="Scrollable route map"
            >
              <div
                className="image-viewer-canvas"
                style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
              >
                <img src={src} alt={alt} draggable={false} />
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

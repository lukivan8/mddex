import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import {
  connectedQuests,
  QUEST_HEIGHT,
  QUEST_WIDTH,
  type QuestGraphData,
} from "./quest-graph";
import {
  designQuestGraph,
  questEdgePath,
  type Point,
} from "./quest-graph-designs";

type Camera = Point & { zoom: number };
const clampZoom = (zoom: number) => Math.max(0.05, Math.min(2, zoom));
export function QuestGraphCanvas({
  active,
  data,
  selectedKey,
  matchKeys,
  filtering,
  onSelect,
}: {
  active: boolean;
  data: QuestGraphData;
  selectedKey: string;
  matchKeys: Set<string>;
  filtering: boolean;
  onSelect: (key: string) => void;
}) {
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setVertical(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const layout = useMemo(
    () => designQuestGraph(data, vertical),
    [data, vertical],
  );
  const ancestors = useMemo(
    () => connectedQuests(selectedKey, layout.parents),
    [selectedKey, layout],
  );
  const view = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 24, y: 24, zoom: 1 });
  const cameraRef = useRef(camera);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef({ distance: 0, blockClickUntil: 0 });
  const [size, setSize] = useState({ width: 800, height: 650 });
  const move = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);
  const zoomAt = useCallback(
    (zoom: number, point: Point) => {
      const old = cameraRef.current;
      const next = clampZoom(zoom);
      const ratio = next / old.zoom;
      move({
        x: point.x - (point.x - old.x) * ratio,
        y: point.y - (point.y - old.y) * ratio,
        zoom: next,
      });
    },
    [move],
  );
  const fit = useCallback(
    (keys: string[]) => {
      const element = view.current;
      if (!element) return;
      const points = keys.map((key) => layout.positions[key]).filter(Boolean);
      if (!points.length) return;
      const left = Math.min(...points.map((p) => p.x)),
        top = Math.min(...points.map((p) => p.y));
      const width =
        Math.max(...points.map((p) => p.x + QUEST_WIDTH)) - left + 100;
      const height =
        Math.max(...points.map((p) => p.y + QUEST_HEIGHT + 72)) - top + 100;
      const zoom = clampZoom(
        Math.min(
          1.2,
          element.clientWidth / width,
          element.clientHeight / height,
        ),
      );
      move({
        x: (element.clientWidth - (width - 100) * zoom) / 2 - left * zoom,
        y: (element.clientHeight - (height - 100) * zoom) / 2 - top * zoom,
        zoom,
      });
    },
    [layout, move],
  );
  const centered = useRef<{ key: string; layout: typeof layout } | null>(null);
  useEffect(() => {
    const element = view.current;
    if (!element || !active) return;
    if (
      centered.current?.key === selectedKey &&
      centered.current.layout === layout
    )
      return;
    centered.current = { key: selectedKey, layout };
    const point = layout.positions[selectedKey];
    const old = cameraRef.current;
    move({
      x: element.clientWidth / 2 - (point.x + QUEST_WIDTH / 2) * old.zoom,
      y:
        (element.clientWidth < 700 ? 120 : element.clientHeight / 2) -
        (point.y + QUEST_HEIGHT / 2) * old.zoom,
      zoom: old.zoom,
    });
  }, [selectedKey, layout, move, active]);
  useEffect(() => {
    const element = view.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const old = cameraRef.current;
      if (
        event.shiftKey ||
        (Math.abs(event.deltaX) > Math.abs(event.deltaY) && !event.ctrlKey)
      )
        move({
          ...old,
          x: old.x - event.deltaX - (event.shiftKey ? event.deltaY : 0),
          y: old.y - (event.shiftKey ? 0 : event.deltaY),
        });
      else
        zoomAt(old.zoom * Math.exp(-event.deltaY * 0.002), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", wheel);
    };
  }, [move, zoomAt]);
  const localPoint = (point: Point) => {
    const rect = view.current!.getBoundingClientRect();
    return { x: point.x - rect.left, y: point.y - rect.top };
  };
  const selectedSet = new Set([selectedKey, ...ancestors]);
  const orderedEdges = [...layout.edges].sort(
    (a, b) =>
      Number(selectedSet.has(a.from) && selectedSet.has(a.to)) -
      Number(selectedSet.has(b.from) && selectedSet.has(b.to)),
  );
  return (
    <section
      hidden={!active}
      id="quest-graph"
      className="quest-graph-panel quest-pan-panel"
      aria-label="Quest dependency graph"
    >
      <div className="quest-graph-controls">
        <div className="quest-zoom">
          <button
            type="button"
            aria-label="Fit graph width"
            onClick={() => fit(layout.nodes.map((node) => node.source_key))}
          >
            <Maximize size={14} />
            All
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={camera.zoom <= 0.05}
            onClick={() =>
              zoomAt(camera.zoom - 0.15, {
                x: size.width / 2,
                y: size.height / 2,
              })
            }
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={() => zoomAt(1, { x: size.width / 2, y: size.height / 2 })}
          >
            {Math.round(camera.zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={camera.zoom >= 2}
            onClick={() =>
              zoomAt(camera.zoom + 0.15, {
                x: size.width / 2,
                y: size.height / 2,
              })
            }
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div
        ref={view}
        className="quest-graph-viewport quest-pan-viewport"
        tabIndex={0}
        aria-label="Scrollable quest graph"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          drag.current.distance = 0;
        }}
        onPointerMove={(event) => {
          const before = pointers.current.get(event.pointerId);
          if (!before) return;
          const prior = [...pointers.current.values()];
          const after = { x: event.clientX, y: event.clientY };
          pointers.current.set(event.pointerId, after);
          drag.current.distance += Math.hypot(
            after.x - before.x,
            after.y - before.y,
          );
          if (drag.current.distance < 4) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current.blockClickUntil = Date.now() + 400;
          if (prior.length === 2) {
            const next = [...pointers.current.values()];
            const centre = (points: Point[]) => ({
              x: (points[0].x + points[1].x) / 2,
              y: (points[0].y + points[1].y) / 2,
            });
            const oldCentre = centre(prior),
              newCentre = centre(next);
            const distance = (points: Point[]) =>
              Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            zoomAt(
              (cameraRef.current.zoom * distance(next)) /
                Math.max(1, distance(prior)),
              localPoint(oldCentre),
            );
            const old = cameraRef.current;
            move({
              ...old,
              x: old.x + newCentre.x - oldCentre.x,
              y: old.y + newCentre.y - oldCentre.y,
            });
          } else {
            const old = cameraRef.current;
            move({
              ...old,
              x: old.x + after.x - before.x,
              y: old.y + after.y - before.y,
            });
          }
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
        onClickCapture={(event) => {
          if (Date.now() < drag.current.blockClickUntil) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const old = cameraRef.current;
          if (event.key === "+" || event.key === "=")
            zoomAt(old.zoom + 0.15, { x: size.width / 2, y: size.height / 2 });
          else if (event.key === "-")
            zoomAt(old.zoom - 0.15, { x: size.width / 2, y: size.height / 2 });
          else if (event.key.toLowerCase() === "f")
            fit([selectedKey, ...ancestors]);
          else if (event.key.startsWith("Arrow")) {
            move({
              ...old,
              x:
                old.x +
                (event.key === "ArrowLeft"
                  ? 80
                  : event.key === "ArrowRight"
                    ? -80
                    : 0),
              y:
                old.y +
                (event.key === "ArrowUp"
                  ? 80
                  : event.key === "ArrowDown"
                    ? -80
                    : 0),
            });
          } else return;
          event.preventDefault();
        }}
      >
        <div
          className="quest-graph-canvas"
          data-design="metro"
          data-orientation={layout.orientation}
          style={
            {
              width: Math.round(layout.width * camera.zoom),
              height: Math.round(layout.height * camera.zoom),
              left: Math.round(camera.x),
              top: Math.round(camera.y),
              "--quest-zoom": camera.zoom,
            } as CSSProperties
          }
        >
          {layout.bands.map((band, i) => (
            <div
              key={i}
              className="quest-graph-band"
              style={{
                left: Math.round(band.x * camera.zoom),
                top: Math.round(band.y * camera.zoom),
                width: Math.round(band.width * camera.zoom),
                height: Math.round(band.height * camera.zoom),
              }}
            >
              <span>{band.label}</span>
            </div>
          ))}
          <svg
            width={Math.round(layout.width * camera.zoom)}
            height={Math.round(layout.height * camera.zoom)}
            className="quest-edges"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="quest-arrow"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7" fill="context-stroke" />
              </marker>
            </defs>
            <g transform={`scale(${camera.zoom})`}>
              {orderedEdges.map((edge) => {
                const required =
                  selectedSet.has(edge.from) && selectedSet.has(edge.to);
                const story =
                  data.nodes.find((node) => node.source_key === edge.from)
                    ?.type === "Core Quest" &&
                  data.nodes.find((node) => node.source_key === edge.to)
                    ?.type === "Core Quest";
                return (
                  <path
                    key={`${edge.from}:${edge.to}`}
                    className={
                      required
                        ? "quest-edge-ancestor"
                        : story
                          ? "quest-edge-story"
                          : ""
                    }
                    d={questEdgePath(
                      layout.positions[edge.from],
                      layout.positions[edge.to],
                    )}
                    markerEnd="url(#quest-arrow)"
                  />
                );
              })}
            </g>
          </svg>
          {layout.nodes.map((node) => {
            const position = layout.positions[node.source_key],
              active = node.source_key === selectedKey,
              required = ancestors.has(node.source_key);
            const locationName = node.area || node.start_location?.name || "";
            const locationReference = [
              ...node.locations,
              ...(node.start_location ? [node.start_location] : []),
            ].find(
              (row) =>
                (row.title ||
                  row.name ||
                  (row.catalog_slug
                    ? data.catalogLinks[row.catalog_slug]?.name
                    : "")) === locationName,
            );
            const locationImage = locationReference?.catalog_slug
              ? data.catalogLinks[locationReference.catalog_slug]?.image
              : null;
            return (
              <div key={node.source_key}>
                <button
                  type="button"
                  className={`quest-node ${node.type === "Core Quest" ? "quest-node-core" : ""} ${required ? "quest-node-required" : ""} ${filtering && !matchKeys.has(node.source_key) && !required && !active ? "quest-node-dim" : ""}`}
                  style={{
                    left: Math.round(position.x * camera.zoom),
                    top: Math.round(position.y * camera.zoom),
                    width: Math.round(QUEST_WIDTH * camera.zoom),
                    height: Math.round(QUEST_HEIGHT * camera.zoom),
                  }}
                  aria-label={node.name}
                  aria-pressed={active}
                  onClick={() => onSelect(node.source_key)}
                >
                  <span className="quest-node-type">
                    {node.type === "Core Quest"
                      ? `MSQ ${node.order ?? ""}`
                      : "Side quest"}
                    <span>
                      {active
                        ? "Selected"
                        : required
                          ? "Required"
                          : node.repeatable
                            ? "↻"
                            : ""}
                    </span>
                  </span>
                  <strong>{node.name}</strong>
                  <span className="quest-node-meta">
                    <span className="quest-node-location">
                      {locationImage && (
                        <img
                          src={locationImage}
                          alt=""
                          width={14}
                          height={14}
                          loading="lazy"
                        />
                      )}
                      {locationName}
                    </span>
                    {node.recommended_level != null && (
                      <span>Rec. lvl {node.recommended_level}</span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="quest-minimap"
        aria-label="Navigate graph overview"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.detail
              ? ((event.clientX - rect.left) / rect.width) * layout.width
              : layout.width / 2,
            y = event.detail
              ? ((event.clientY - rect.top) / rect.height) * layout.height
              : layout.height / 2;
          const old = cameraRef.current;
          move({
            ...old,
            x: size.width / 2 - x * old.zoom,
            y: size.height / 2 - y * old.zoom,
          });
        }}
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {layout.nodes.map((node) => {
            const p = layout.positions[node.source_key];
            return (
              <rect
                key={node.source_key}
                x={p.x}
                y={p.y}
                width={QUEST_WIDTH}
                height={QUEST_HEIGHT}
                className={
                  node.source_key === selectedKey
                    ? "minimap-selected"
                    : ancestors.has(node.source_key)
                      ? "minimap-required"
                      : node.type === "Core Quest"
                        ? "minimap-core"
                        : ""
                }
              />
            );
          })}
          <rect
            className="quest-minimap-window"
            x={-camera.x / camera.zoom}
            y={-camera.y / camera.zoom}
            width={size.width / camera.zoom}
            height={size.height / camera.zoom}
          />
        </svg>
        <span>Overview · click to navigate</span>
      </button>
    </section>
  );
}

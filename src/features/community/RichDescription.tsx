import { useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { Bold, Italic, Heading2, List, ListOrdered } from "lucide-react";
import type { Description } from "./community.schema";

export function DescriptionContent({ value }: { value: Description }) {
  const line = (parts: Description[number]["content"][number]) =>
    parts.map((part, index) => {
      let text = <span>{part.text}</span>;
      if (part.bold) text = <strong>{text}</strong>;
      if (part.italic) text = <em>{text}</em>;
      return <span key={index}>{text}</span>;
    });
  return (
    <div className="community-prose">
      {value.map((block, index) => {
        if (block.type === "heading")
          return <h2 key={index}>{block.content.map(line)}</h2>;
        if (block.type === "bulletList")
          return (
            <ul key={index}>
              {block.content.map((parts, i) => (
                <li key={i}>{line(parts)}</li>
              ))}
            </ul>
          );
        if (block.type === "orderedList")
          return (
            <ol key={index}>
              {block.content.map((parts, i) => (
                <li key={i}>{line(parts)}</li>
              ))}
            </ol>
          );
        return (
          <p key={index}>
            {block.content.map((parts, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line(parts)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function serializeEditor(root: HTMLElement): Description {
  function inline(
    node: Node,
    bold = false,
    italic = false,
  ): Description[number]["content"][number] {
    if (node.nodeType === Node.TEXT_NODE)
      return [
        {
          text: node.textContent ?? "",
          ...(bold ? { bold: true } : {}),
          ...(italic ? { italic: true } : {}),
        },
      ];
    if (
      !(node instanceof HTMLElement) ||
      ["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName)
    )
      return [];
    if (node.tagName === "BR") return [{ text: "\n" }];
    return Array.from(node.childNodes).flatMap((child) =>
      inline(
        child,
        bold || ["B", "STRONG"].includes(node.tagName),
        italic || ["I", "EM"].includes(node.tagName),
      ),
    );
  }
  const blocks: Description = [];
  for (const node of root.childNodes) {
    if (node instanceof HTMLElement && ["UL", "OL"].includes(node.tagName)) {
      blocks.push({
        type: node.tagName === "UL" ? "bulletList" : "orderedList",
        content: Array.from(node.children).map((child) => inline(child)),
      });
    } else {
      const content = inline(node);
      if (content.some((part) => part.text.trim()))
        blocks.push({
          type:
            node instanceof HTMLElement && /^H[1-6]$/.test(node.tagName)
              ? "heading"
              : "paragraph",
          content: [content],
        });
    }
  }
  return blocks;
}

export function RichDescriptionEditor({
  initialValue,
  onChange,
}: {
  initialValue: Description;
  onChange: (value: Description) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const initial = useRef(initialValue);
  useEffect(() => {
    const root = editor.current;
    if (!root) return;
    const addInline = (
      element: HTMLElement,
      parts: Description[number]["content"][number],
    ) =>
      parts.forEach((part) => {
        let node: Node = document.createTextNode(part.text);
        if (part.bold) {
          const strong = document.createElement("strong");
          strong.appendChild(node);
          node = strong;
        }
        if (part.italic) {
          const em = document.createElement("em");
          em.appendChild(node);
          node = em;
        }
        element.appendChild(node);
      });
    root.replaceChildren();
    initial.current.forEach((block) => {
      const element = document.createElement(
        block.type === "heading"
          ? "h2"
          : block.type === "bulletList"
            ? "ul"
            : block.type === "orderedList"
              ? "ol"
              : "p",
      );
      block.content.forEach((parts, i) => {
        if (block.type === "bulletList" || block.type === "orderedList") {
          const li = document.createElement("li");
          addInline(li, parts);
          element.appendChild(li);
        } else {
          if (i) element.appendChild(document.createElement("br"));
          addInline(element, parts);
        }
      });
      root.appendChild(element);
    });
  }, []);
  const format = (command: string) => {
    editor.current?.focus();
    document.execCommand(
      command,
      false,
      command === "formatBlock" ? "h2" : undefined,
    );
    if (editor.current) onChange(serializeEditor(editor.current));
  };
  return (
    <div className="community-editor">
      <div
        className="community-editor-toolbar"
        role="toolbar"
        aria-label="Description formatting"
      >
        {[
          { label: "Bold", command: "bold", Icon: Bold },
          { label: "Italic", command: "italic", Icon: Italic },
          { label: "Heading", command: "formatBlock", Icon: Heading2 },
          { label: "Bullet list", command: "insertUnorderedList", Icon: List },
          {
            label: "Numbered list",
            command: "insertOrderedList",
            Icon: ListOrdered,
          },
        ].map(({ label, command, Icon }) => (
          <Button
            key={command}
            type="button"
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onPress={() => format(command)}
          >
            <Icon size={16} />
          </Button>
        ))}
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Description"
        aria-multiline="true"
        className="community-editor-content community-prose"
        data-placeholder="How does your build play? Add tips, synergies, and equipment swaps."
        onInput={() => {
          if (editor.current) onChange(serializeEditor(editor.current));
        }}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          if (editor.current) onChange(serializeEditor(editor.current));
        }}
      />
    </div>
  );
}

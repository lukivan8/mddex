import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DescriptionContent } from "./RichDescription";
import type { Description } from "./community.schema";

const render = (text: string, bold = false) => {
  const value: Description = [
    { type: "paragraph", content: [[{ text, bold }]] },
  ];
  return renderToStaticMarkup(createElement(DescriptionContent, { value }));
};

describe("creator note links", () => {
  it("links the video URL with query parameters and preserves formatting", () => {
    const html = render(
      "See https://youtu.be/ickJOH4k8b4?si=8D0ylReYAfuGU-wc for more info.",
      true,
    );
    expect(html).toContain(
      'href="https://youtu.be/ickJOH4k8b4?si=8D0ylReYAfuGU-wc"',
    );
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("<strong>");
    expect(html).toContain(" for more info.");
  });

  it("keeps surrounding punctuation outside links and supports www URLs", () => {
    const html = render(
      "(https://example.com/guide). See www.example.com and https://example.com/path_(test).",
    );
    expect(html).toContain('href="https://example.com/guide"');
    expect(html).toContain("</a>). See ");
    expect(html).toContain('href="https://www.example.com"');
    expect(html).toContain('href="https://example.com/path_(test)"');
  });

  it("keeps unsafe schemes, malformed URLs and markup as plain text", () => {
    const html = render(
      "javascript:alert(1) https:// <script>alert(1)</script>",
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

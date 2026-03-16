import { describe, it, expect } from "vitest";
import { wrapInHtmlTemplate } from "../html-template";

describe("wrapInHtmlTemplate", () => {
  const baseOptions = {
    body: "Hello, this is a test email.",
    subject: "Test Subject",
    brandColor: "#ff5500",
    operatorName: "SkyHigh Flight School",
  };

  it("contains the brand color in the output", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).toContain("#ff5500");
  });

  it("includes logo when logoUrl is provided", () => {
    const html = wrapInHtmlTemplate({
      ...baseOptions,
      logoUrl: "https://example.com/logo.png",
    });
    expect(html).toContain("https://example.com/logo.png");
    expect(html).toContain("<img");
  });

  it("omits logo section when logoUrl is not provided", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).not.toContain("<img");
  });

  it("includes unsubscribe link when provided", () => {
    const html = wrapInHtmlTemplate({
      ...baseOptions,
      unsubscribeUrl: "https://example.com/unsubscribe",
    });
    expect(html).toContain("https://example.com/unsubscribe");
    expect(html).toContain("Unsubscribe");
  });

  it("omits unsubscribe link when not provided", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).not.toContain("Unsubscribe");
  });

  it("includes body content in the output", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).toContain("Hello, this is a test email.");
  });

  it("converts newlines in body to <br> tags", () => {
    const html = wrapInHtmlTemplate({
      ...baseOptions,
      body: "Line one\nLine two\nLine three",
    });
    expect(html).toContain("Line one<br>Line two<br>Line three");
  });

  it("outputs valid HTML structure with <html> and <body> tags", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<body");
    expect(html).toContain("</body>");
  });

  it("includes operator name in the footer", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).toContain("SkyHigh Flight School");
    expect(html).toContain("Powered by AirOps");
  });

  it("includes the subject in the header and title", () => {
    const html = wrapInHtmlTemplate(baseOptions);
    expect(html).toContain("<title>Test Subject</title>");
  });

  it("escapes HTML special characters in body content", () => {
    const html = wrapInHtmlTemplate({
      ...baseOptions,
      body: "Hello <script>alert('xss')</script> & welcome",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; welcome");
  });
});

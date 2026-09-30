import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmationEmail, sendConfirmationEmail } from "./community.email";

afterEach(() => vi.unstubAllGlobals());
describe("Resend OTP delivery", () => {
  it("sends branded multipart content with a stable idempotency key", async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));
    vi.stubGlobal("fetch", send);
    await sendConfirmationEmail(
      "secret",
      "builds@mddex.net",
      "owner@example.com",
      "012345",
      "challenge-id",
      true,
    );
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret",
      "Idempotency-Key": "community-otp/challenge-id",
    });
    const message = JSON.parse(init.body);
    expect(message.from).toBe("MDDEX <builds@mddex.net>");
    expect(message.to).toEqual(["owner@example.com"]);
    expect(message.text).toContain("code is 012345");
    expect(message.text).toContain("edit your build");
    expect(message.html).toContain("https://mddex.net/mddex-logo.png");
    expect(message.html).toContain("012345");
    expect(message.html).toContain("Expires in 10 minutes");
  });
  it("rejects provider errors and malformed successful responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "unauthorized" }, { status: 401 }),
      );
    vi.stubGlobal("fetch", send);
    await expect(
      sendConfirmationEmail(
        "secret",
        "builds@mddex.net",
        "owner@example.com",
        "123456",
        "id",
        false,
      ),
    ).rejects.toThrow("Email delivery failed");
    send.mockResolvedValue(Response.json({}));
    await expect(
      sendConfirmationEmail(
        "secret",
        "builds@mddex.net",
        "owner@example.com",
        "123456",
        "id",
        false,
      ),
    ).rejects.toThrow("Invalid email provider response");
    vi.restoreAllMocks();
  });
  it("keeps publish wording distinct and rejects untrusted code markup", () => {
    expect(confirmationEmail("123456").text).toContain("publish your build");
    expect(() => confirmationEmail("<img src=x>")).toThrow();
  });
});

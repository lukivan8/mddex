import { randomId } from "../../lib/random-id";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { communityRequest, CommunityRequestError } from "./community.browser";

const profileKey = "mddex.community-profile.v1";
const profileSchema = z.object({
  email: z.email(),
  displayName: z.string().max(40),
  discord: z.string().max(80),
});
export function readCommunityProfile() {
  try {
    return profileSchema.parse(
      JSON.parse(localStorage.getItem(profileKey) ?? "null"),
    );
  } catch {
    return undefined;
  }
}
export function saveCommunityProfile(profile: z.infer<typeof profileSchema>) {
  try {
    localStorage.setItem(
      profileKey,
      JSON.stringify(profileSchema.parse(profile)),
    );
  } catch {
    /* Storage is optional; server authentication is still required. */
  }
}
function confirmationRequest(email: string, buildId?: string, fresh = false) {
  const key = `mddex.community-otp:${email.toLowerCase()}:${buildId ?? "post"}`;
  try {
    const previous = z
      .object({
        requestId: z.uuid(),
        sessionToken: z.string().regex(/^[a-f0-9]{64}$/),
        created: z.number(),
      })
      .parse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
    if (!fresh && Date.now() - previous.created < 600_000) return previous;
  } catch {
    /* Generate a fresh request. */
  }
  const next = {
    requestId: randomId(),
    sessionToken: Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
    created: Date.now(),
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Retries within this dialog still reuse the credential. */
  }
  return next;
}
export function CommunityEmailConfirmation({
  initialEmail,
  buildId,
  autoSend = false,
  onClose,
  onVerified,
}: {
  initialEmail: string;
  buildId?: string;
  autoSend?: boolean;
  onClose: () => void;
  onVerified: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [challenge, setChallenge] = useState<{
    id: string;
    sessionToken: string;
  }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const inFlight = useRef(false);
  const send = useCallback(
    async (address: string, fresh = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      try {
        const normalized = z
          .email()
          .max(254)
          .parse(address.trim())
          .toLowerCase();
        let attempt = confirmationRequest(normalized, buildId, fresh);
        const requestCode = () =>
          communityRequest("/auth/request", {
            method: "POST",
            body: JSON.stringify({
              email: normalized,
              requestId: attempt.requestId,
              buildId,
            }),
          });
        let response: unknown;
        try {
          response = await requestCode();
        } catch (cause) {
          if (!(cause instanceof CommunityRequestError) || cause.status !== 410)
            throw cause;
          attempt = confirmationRequest(normalized, buildId, true);
          response = await requestCode();
        }
        const result = z
          .object({ challengeId: z.uuid(), expiresAt: z.number() })
          .parse(response);
        setEmail(normalized);
        setChallenge({
          id: result.challengeId,
          sessionToken: attempt.sessionToken,
        });
        setCode("");
        setResendAt(Date.now() + 30_000);
      } catch (cause) {
        setError(
          cause instanceof z.ZodError
            ? "Enter a valid email address."
            : cause instanceof Error
              ? cause.message
              : "Could not send code.",
        );
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [buildId],
  );
  useEffect(() => {
    if (autoSend) void send(initialEmail);
  }, [autoSend, initialEmail, send]);
  useEffect(() => {
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = z
        .object({
          email: z.email(),
          displayName: z.string().nullable().optional(),
          expiresAt: z.number(),
        })
        .parse(
          await communityRequest("/auth/verify", {
            method: "POST",
            body: JSON.stringify({
              challengeId: challenge.id,
              code,
              sessionToken: challenge.sessionToken,
            }),
          }),
        );
      const previous = readCommunityProfile();
      try {
        sessionStorage.removeItem(
          `mddex.community-otp:${email.toLowerCase()}:${buildId ?? "post"}`,
        );
      } catch {
        /* The persistent credential is held by the HttpOnly cookie. */
      }
      saveCommunityProfile({
        email: result.email,
        displayName: result.displayName ?? previous?.displayName ?? "",
        discord: previous?.discord ?? "",
      });
      await onVerified(result.email);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not confirm email.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="community-email-dialog">
          <Modal.Header>
            <Modal.Heading>Confirm your email</Modal.Heading>
            <Modal.CloseTrigger isDisabled={busy} />
          </Modal.Header>
          <Modal.Body>
            {challenge && (
              <Button
                className="community-email-back"
                size="sm"
                variant="ghost"
                isDisabled={busy}
                onPress={() => {
                  setChallenge(undefined);
                  setCode("");
                  setError("");
                }}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Change email
              </Button>
            )}
            {challenge ? (
              <form
                id="community-email-confirm"
                onSubmit={(event) => void verify(event)}
              >
                <p className="muted">
                  {buildId
                    ? "If this email matches the build, a code was sent to "
                    : "Enter the code sent to "}
                  {email}. The code expires in 10 minutes.
                </p>
                <TextField
                  aria-label="Confirmation code"
                  value={code}
                  onChange={(value) =>
                    setCode(value.replace(/\D/g, "").slice(0, 6))
                  }
                  isRequired
                  maxLength={6}
                >
                  <Input
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    placeholder="000000"
                  />
                </TextField>
              </form>
            ) : (
              <form
                id="community-email-confirm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(email);
                }}
              >
                <p className="muted">
                  {buildId
                    ? "Enter the email used to post this build."
                    : "Confirm your email before publishing your build."}
                </p>
                <TextField
                  aria-label="Confirmation email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  isRequired
                  maxLength={254}
                >
                  <Input
                    autoFocus
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </TextField>
              </form>
            )}
            {error && (
              <p role="alert" className="community-error">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            {challenge && (
              <Button
                variant="ghost"
                isDisabled={busy || seconds > 0}
                onPress={() => void send(email, true)}
              >
                {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
              </Button>
            )}
            <Button
              type="submit"
              form="community-email-confirm"
              isPending={busy}
              isDisabled={!!challenge && code.length !== 6}
            >
              {challenge ? "Confirm email" : "Send code"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

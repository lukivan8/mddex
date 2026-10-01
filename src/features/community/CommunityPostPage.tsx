import { randomId } from "../../lib/random-id";
import { DiscordIcon } from "../../components/DiscordIcon";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import { getBuildCollections, type BuildCollections } from "../builds/build.db";
import { createBuild, setWorkspace } from "../builds/build.service";
import type { Build } from "../builds/build.types";
import { loadSessionCatalog } from "../catalog/catalog.session";
import type { CatalogItem } from "../catalog/catalog.types";
import { communityRequest, CommunityRequestError } from "./community.browser";
import {
  CommunityEmailConfirmation,
  readCommunityProfile,
  saveCommunityProfile,
} from "./CommunityEmailConfirmation";
import {
  communityBuildSchema,
  communityDraftSchema,
  communityPostSchema,
  descriptionSchema,
  tagsSchema,
  type CommunityBuild,
  type Description,
} from "./community.schema";
import { RichDescriptionEditor } from "./RichDescription";
import { EquipmentPreview } from "./CommunityPage";
import { z } from "zod";

const draftKey = "mddex.community-draft.v1";
const formDraftSchema = z.object({
  name: z.string(),
  tags: tagsSchema,
  description: descriptionSchema,
  displayName: z.string(),
  discord: z.string(),
  selectedId: z.string(),
  inheritName: z.boolean().optional(),
});
export function CommunityPostPage({ edit }: { edit?: CommunityBuild }) {
  const [db, setDb] = useState<BuildCollections>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const ready = getBuildCollections();
        await Promise.all([
          ready.builds.preload(),
          ready.preferences.preload(),
        ]);
        if (active) setDb(ready);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your local builds",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  if (!db)
    return (
      <div className="community-form-page">
        <Link to="/community" className="community-back">
          <ArrowLeft size={15} />
          Community builds
        </Link>
        <div className="community-message" role={error ? "alert" : "status"}>
          {error || "Loading your local builds…"}
        </div>
      </div>
    );
  return <PostForm db={db} edit={edit} />;
}
function PostForm({
  db,
  edit,
}: {
  db: BuildCollections;
  edit?: CommunityBuild;
}) {
  const { data: localBuilds } = useLiveQuery((query) =>
    query.from({ build: db.builds }),
  );
  const builds = useMemo(
    () =>
      [...localBuilds].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [localBuilds],
  );
  const [restored] = useState(() => {
    if (edit) return undefined;
    try {
      return formDraftSchema.parse(
        JSON.parse(sessionStorage.getItem(draftKey) ?? "null"),
      );
    } catch {
      return undefined;
    }
  });
  const activeId = db.preferences.get("workspace")?.activeId;
  const [selectedId, setSelectedId] = useState(
    edit
      ? ""
      : restored?.inheritName && activeId && db.builds.has(activeId)
        ? activeId
        : restored && db.builds.has(restored.selectedId)
          ? restored.selectedId
          : (activeId ?? [...db.builds.values()][0]?.id ?? ""),
  );
  const chosen: Build | undefined = selectedId
    ? db.builds.get(selectedId)
    : edit?.build;
  const [name, setName] = useState(
    edit?.name ??
      (!restored?.inheritName && restored?.selectedId === selectedId
        ? restored.name
        : chosen?.name) ??
      "",
  );
  const [tags, setTags] = useState(edit?.tags ?? restored?.tags ?? []);
  const [description, setDescription] = useState<Description>(
    edit?.description ?? restored?.description ?? [],
  );
  const [profile] = useState(readCommunityProfile);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<
    z.infer<typeof communityDraftSchema> & { email?: string }
  >();
  const [displayName, setDisplayName] = useState(
    edit?.displayName ?? restored?.displayName ?? profile?.displayName ?? "",
  );
  const [discord, setDiscord] = useState(
    edit?.discord ?? restored?.discord ?? profile?.discord ?? "",
  );
  const [email, setEmail] = useState(profile?.email ?? "");
  const [tagInput, setTagInput] = useState("");
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const publishingAttempt = useRef<{ fingerprint: string; key: string }>(
    undefined,
  );
  const [error, setError] = useState("");
  const [nameOwner, setNameOwner] = useState<{
    email: string;
    displayName: string;
  }>();
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    displayName?: string;
  }>({});
  const nameMismatch =
    nameOwner &&
    (edit || email.trim().toLowerCase() === nameOwner.email) &&
    displayName.trim().normalize("NFKC").toLowerCase() !==
      nameOwner.displayName.trim().normalize("NFKC").toLowerCase();
  const emailError =
    fieldErrors.email ??
    (nameMismatch
      ? "This email is registered with a different display name."
      : undefined);
  const displayNameError =
    fieldErrors.displayName ??
    (nameMismatch ? `Use ${nameOwner.displayName} for this email.` : undefined);
  const initialIdentity = useRef({ email, editing: !!edit });
  useEffect(() => {
    let active = true;
    void communityRequest("/auth/session")
      .then((data) => {
        const session = z
          .object({
            email: z.string().nullable(),
            displayName: z.string().nullable().optional(),
          })
          .parse(data);
        if (active && session.email && session.displayName) {
          setNameOwner({
            email: session.email,
            displayName: session.displayName,
          });
          const initial = initialIdentity.current;
          if (
            initial.editing ||
            !initial.email ||
            initial.email.trim().toLowerCase() === session.email
          ) {
            setDisplayName(session.displayName);
            if (!initial.editing) setEmail(session.email);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const navigate = useNavigate();
  const catalogMap = useMemo(
    () => new Map(catalog.map((item) => [item.slug, item])),
    [catalog],
  );
  useEffect(() => {
    let active = true;
    void loadSessionCatalog()
      .then((items) => {
        if (active) setCatalog(items);
      })
      .catch(() => {});
    void communityRequest("/tags")
      .then((data) => {
        if (active)
          setExistingTags(
            z.object({ tags: z.array(z.string()) }).parse(data).tags,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const choose = (build: Build, id = build.id) => {
    setSelectedId(id);
    setName(build.name);
  };
  const saveDraft = () => {
    if (!edit)
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            name,
            tags,
            description,
            displayName,
            discord,
            selectedId,
          }),
        );
      } catch {
        /* The form still works without session storage. */
      }
  };
  const addTag = (raw: string) => {
    const canonical =
      existingTags.find(
        (tag) => tag.toLowerCase() === raw.trim().toLowerCase(),
      ) ?? raw.trim();
    const parsed = tagsSchema.safeParse([...tags, canonical]);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setTags(parsed.data);
    setTagInput("");
    setError("");
  };
  const newBuild = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    saveDraft();
    try {
      const created = createBuild(db, `Loadout ${builds.length + 1}`);
      await created.transaction.isPersisted.promise;
      await setWorkspace(db, { activeId: created.build.id }).isPersisted
        .promise;
      if (!edit)
        try {
          sessionStorage.setItem(
            draftKey,
            JSON.stringify({
              name: created.build.name,
              tags,
              description,
              displayName,
              discord,
              selectedId: created.build.id,
              inheritName: true,
            }),
          );
        } catch {
          /* Optional draft persistence. */
        }
      await navigate({ to: "/build", search: { community: "post" } });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create a build",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (emailError || displayNameError) return;
    if (!chosen) {
      setError("Choose a local build first.");
      return;
    }
    const draft = {
      build: chosen,
      name,
      tags,
      description,
      displayName,
      discord,
      ...(!edit ? { email } : {}),
    };
    const parsed = (
      edit ? communityDraftSchema : communityPostSchema
    ).safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your build details");
      return;
    }
    saveDraft();
    setPendingDelete(false);
    await saveBuild(parsed.data);
  };
  const saveBuild = async (
    data: z.infer<typeof communityDraftSchema> & { email?: string },
    confirmedEmail?: string,
  ) => {
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      // Keep a request ID with the exact draft across retries and page reloads.
      const fingerprint = JSON.stringify(data);
      let publishKey: string =
        publishingAttempt.current?.fingerprint === fingerprint
          ? publishingAttempt.current.key
          : randomId();
      if (!edit) {
        try {
          const previous = z
            .object({ fingerprint: z.string(), key: z.uuid() })
            .parse(
              JSON.parse(
                sessionStorage.getItem("mddex.community-publish.v1") ?? "null",
              ),
            );
          if (previous.fingerprint === fingerprint) publishKey = previous.key;
        } catch {
          /* First attempt. */
        }
        publishingAttempt.current = { fingerprint, key: publishKey };
        try {
          sessionStorage.setItem(
            "mddex.community-publish.v1",
            JSON.stringify({ fingerprint, key: publishKey }),
          );
        } catch {
          /* Optional reload recovery. */
        }
      }
      const result = z.object({ id: z.uuid() }).parse(
        await communityRequest(edit ? `/${edit.id}` : "", {
          method: edit ? "PUT" : "POST",
          headers: { "Idempotency-Key": publishKey },
          body: fingerprint,
        }),
      );
      const rememberedEmail =
        confirmedEmail ?? data.email ?? readCommunityProfile()?.email;
      if (rememberedEmail)
        saveCommunityProfile({
          email: rememberedEmail,
          displayName: data.displayName,
          discord: data.discord,
        });
      if (!edit)
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* Optional draft storage. */
        }
      await navigate({
        to: "/community/$buildId",
        params: { buildId: result.id },
      });
    } catch (cause) {
      if (
        cause instanceof CommunityRequestError &&
        cause.status === 401 &&
        !confirmedEmail
      ) {
        saveDraft();
        setPendingDraft(data);
        setConfirmationOpen(true);
      } else {
        if (cause instanceof CommunityRequestError && cause.fields) {
          setFieldErrors(cause.fields);
        } else if (confirmedEmail) throw cause;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not publish your build",
        );
      }
    } finally {
      setBusy(false);
    }
  };
  const deleteBuild = async (confirmedEmail?: string) => {
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      await communityRequest(`/${edit.id}/delete`, {
        method: "POST",
        body: "{}",
      });
      await navigate({ to: "/community" });
    } catch (cause) {
      if (
        cause instanceof CommunityRequestError &&
        cause.status === 401 &&
        !confirmedEmail
      ) {
        setPendingDelete(true);
        setDeleteOpen(false);
        setConfirmationOpen(true);
      } else {
        if (cause instanceof CommunityRequestError && cause.fields) {
          setFieldErrors(cause.fields);
        } else if (confirmedEmail) throw cause;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not delete your build.",
        );
      }
    } finally {
      setBusy(false);
    }
  };
  const suggestions = existingTags
    .filter(
      (tag) =>
        !tags.some(
          (chosenTag) => chosenTag.toLowerCase() === tag.toLowerCase(),
        ) && tag.toLowerCase().includes(tagInput.toLowerCase()),
    )
    .slice(0, 8);
  return (
    <div className="community-form-page">
      <div className="community-form-top">
        <Link
          to={edit ? "/community/$buildId" : "/community"}
          params={edit ? { buildId: edit.id } : {}}
          className="community-back"
        >
          <ArrowLeft size={15} />
          {edit ? "Back to build" : "Community builds"}
        </Link>
        {edit && (
          <Button
            variant="danger"
            isDisabled={busy}
            onPress={() => {
              setError("");
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={15} />
            Delete build
          </Button>
        )}
      </div>
      <h1>
        {edit ? "Edit your build" : "Post a build"}
        <span className="accent">.</span>
      </h1>
      <p className="muted">Choose your build and share it with the community</p>
      <form onBlur={saveDraft} onSubmit={(event) => void submit(event)}>
        <fieldset className="community-build-picker">
          <legend>Your local builds</legend>
          <div className="community-local-builds">
            {edit && (
              <button
                type="button"
                className={`community-local-build ${selectedId === "" ? "selected" : ""}`}
                aria-pressed={selectedId === ""}
                onClick={() => choose(edit.build, "")}
              >
                <span className="community-local-build-name">
                  <strong>{edit.name}</strong>
                  <span className="muted">Published equipment</span>
                </span>
                <EquipmentPreview build={edit.build} catalog={catalogMap} />
                <span className="community-local-build-check">
                  {selectedId === "" && <Check size={16} />}
                </span>
              </button>
            )}
            {builds.map((build) => (
              <button
                key={build.id}
                type="button"
                className={`community-local-build ${selectedId === build.id ? "selected" : ""}`}
                aria-pressed={selectedId === build.id}
                onClick={() => choose(build)}
              >
                <span className="community-local-build-name">
                  <strong>{build.name}</strong>
                </span>
                <EquipmentPreview build={build} catalog={catalogMap} />
                <span className="community-local-build-check">
                  {selectedId === build.id && <Check size={16} />}
                </span>
              </button>
            ))}
          </div>
          {!builds.length && !edit && (
            <p className="muted">
              No local builds yet. Create your first loadout in the builder.
            </p>
          )}
          {!edit && (
            <Button
              type="button"
              variant="ghost"
              onPress={() => void newBuild()}
              isPending={busy}
            >
              <Plus size={15} />
              Create a new build
              <ArrowRight size={15} />
            </Button>
          )}
        </fieldset>
        <label className="community-field">
          <span>Build name</span>
          <TextField
            aria-label="Build name"
            value={name}
            onChange={setName}
            isRequired
            maxLength={80}
          >
            <Input />
          </TextField>
          <small className="muted">
            Inherited from your build. You can edit it here.
          </small>
        </label>
        <div className="community-field">
          <span id="community-tags-label">Tags</span>
          <div className="community-tags">
            {tags.map((tag) => (
              <button
                type="button"
                className="community-tag"
                key={tag}
                aria-label={`Remove ${tag} tag`}
                onClick={() => setTags(tags.filter((value) => value !== tag))}
              >
                {tag}
                <X size={12} />
              </button>
            ))}
          </div>
          <div className="community-tag-entry">
            <TextField
              aria-label="Search or create tag"
              value={tagInput}
              onChange={setTagInput}
              maxLength={32}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (tagInput.trim()) addTag(tagInput);
                }
              }}
            >
              <Input placeholder="Search tags or add your own" />
            </TextField>
            <Button
              type="button"
              variant="secondary"
              isDisabled={!tagInput.trim() || tags.length >= 10}
              onPress={() => addTag(tagInput)}
            >
              Add tag
            </Button>
          </div>
          <div
            className="community-tag-suggestions"
            aria-label="Suggested tags"
          >
            {suggestions.map((tag) => (
              <button
                type="button"
                className="community-tag"
                key={tag}
                onClick={() => addTag(tag)}
              >
                {tag}
              </button>
            ))}
            {tagInput.trim() &&
              !existingTags.some(
                (tag) => tag.toLowerCase() === tagInput.trim().toLowerCase(),
              ) && (
                <button
                  type="button"
                  className="community-tag"
                  onClick={() => addTag(tagInput)}
                >
                  Create “{tagInput.trim()}”
                </button>
              )}
          </div>
          <small className="muted">
            Choose existing tags or create your own. Up to 10 tags.
          </small>
        </div>
        <div className="community-field">
          <span>Description</span>
          <RichDescriptionEditor
            initialValue={description}
            onChange={setDescription}
          />
        </div>
        {!edit && (
          <label className="community-field">
            <span>Email</span>
            <TextField
              aria-label="Email"
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                initialIdentity.current.email = value;
                setFieldErrors({});
                if (nameOwner?.email === value.trim().toLowerCase())
                  setDisplayName(nameOwner.displayName);
              }}
              isInvalid={!!emailError}
              isRequired
              maxLength={254}
            >
              <Input
                autoComplete="email"
                placeholder="you@example.com"
                aria-describedby={
                  emailError ? "community-email-name-error" : undefined
                }
              />
            </TextField>
            {emailError && (
              <small
                id="community-email-name-error"
                role="alert"
                className="community-field-error"
              >
                {emailError}
              </small>
            )}
            <small className="muted">
              Private. You will need to confirm this email, so check it for
              errors
            </small>
          </label>
        )}
        <div className="community-form-columns">
          <label className="community-field">
            <span>Display name</span>
            <TextField
              aria-label="Display name"
              value={displayName}
              onChange={(value) => {
                setDisplayName(value);
                setFieldErrors({});
              }}
              isInvalid={!!displayNameError}
              isRequired
              maxLength={40}
            >
              <Input
                autoComplete="nickname"
                aria-describedby={
                  displayNameError ? "community-display-name-error" : undefined
                }
              />
            </TextField>
            {displayNameError && (
              <small
                id="community-display-name-error"
                role="alert"
                className="community-field-error"
              >
                {displayNameError}
              </small>
            )}
          </label>
          <label className="community-field">
            <span>
              Discord <small className="muted">(optional)</small>
            </span>
            <TextField
              aria-label="Discord"
              value={discord}
              onChange={setDiscord}
              maxLength={80}
            >
              <div className="community-discord-input">
                <span className="community-discord-input-icon">
                  <DiscordIcon />
                </span>
                <Input placeholder="Your Discord username" />
              </div>
            </TextField>
          </label>
        </div>
        {error && (
          <p role="alert" className="community-error">
            {error}
          </p>
        )}
        <div className="community-form-actions">
          <Button type="submit" isPending={busy}>
            {edit ? "Save changes" : "Publish build"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
      {edit && deleteOpen && (
        <Modal.Backdrop
          isOpen
          isDismissable={!busy}
          onOpenChange={(open) => {
            if (!open && !busy) setDeleteOpen(false);
          }}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Delete build?</Modal.Heading>
                <Modal.CloseTrigger isDisabled={busy} />
              </Modal.Header>
              <Modal.Body>
                <p>
                  Delete “{edit.name}”? It will be removed from Community
                  Builds. Only the site owner can restore it.
                </p>
                {error && (
                  <p role="alert" className="community-error">
                    {error}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  isDisabled={busy}
                  onPress={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={busy}
                  onPress={() => void deleteBuild()}
                >
                  Delete build
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
      {confirmationOpen && (pendingDraft || pendingDelete) && (
        <CommunityEmailConfirmation
          initialEmail={pendingDraft?.email ?? email}
          buildId={edit?.id}
          autoSend={!!(pendingDraft?.email ?? email)}
          onClose={() => setConfirmationOpen(false)}
          onVerified={async (confirmedEmail) => {
            if (pendingDelete) {
              await deleteBuild(confirmedEmail);
              setConfirmationOpen(false);
              return;
            }
            if (!pendingDraft) return;
            setEmail(confirmedEmail);
            await saveBuild(
              edit ? pendingDraft : { ...pendingDraft, email: confirmedEmail },
              confirmedEmail,
            );
            setConfirmationOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function CommunityEditPage({ buildId }: { buildId: string }) {
  const [post, setPost] = useState<CommunityBuild>();
  const [loading, setLoading] = useState(true);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [error, setError] = useState("");
  const [profile] = useState(readCommunityProfile);
  useEffect(() => {
    let active = true;
    void communityRequest(`/${buildId}/edit`)
      .then((data) => {
        if (active) setPost(communityBuildSchema.parse(data));
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof CommunityRequestError && cause.status === 401)
          setConfirmationOpen(true);
        else
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your build",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [buildId]);
  if (loading)
    return (
      <div className="community-message" role="status">
        Checking your edit access…
      </div>
    );
  if (post) return <CommunityPostPage edit={post} />;
  return (
    <div className="community-form-page">
      <Link
        to="/community/$buildId"
        params={{ buildId }}
        className="community-back"
      >
        <ArrowLeft size={15} />
        Back to build
      </Link>
      <h1 className="community-confirm-heading">
        Edit your build<span className="accent">.</span>
      </h1>
      {error && (
        <p className="community-error" role="alert">
          {error}
        </p>
      )}
      <Button onPress={() => setConfirmationOpen(true)}>
        Confirm email to edit
      </Button>
      {confirmationOpen && (
        <CommunityEmailConfirmation
          initialEmail={profile?.email ?? ""}
          buildId={buildId}
          autoSend={!!profile?.email}
          onClose={() => setConfirmationOpen(false)}
          onVerified={async () => {
            setPost(
              communityBuildSchema.parse(
                await communityRequest(`/${buildId}/edit`),
              ),
            );
            setConfirmationOpen(false);
          }}
        />
      )}
    </div>
  );
}

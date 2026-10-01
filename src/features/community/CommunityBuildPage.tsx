import { DiscordIcon } from "../../components/DiscordIcon";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@heroui/react";
import { ArrowLeft, Copy, Pencil, Sparkles, Square } from "lucide-react";
import type { CatalogItem } from "../catalog/catalog.types";
import { loadSessionCatalog } from "../catalog/catalog.session";
import { normalizeDetailItem } from "../catalog-details/catalog-detail.loader";
import { itemPath } from "../catalog-details/catalog-detail.model";
import { getBuildCollections } from "../builds/build.db";
import { setWorkspace } from "../builds/build.service";
import { type Build, type BuildSlot, isGearSlot } from "../builds/build.types";
import { slotRules } from "../builds/build.compatibility";
import { selectedTier } from "../builds/build.tiers";
import {
  uniqueEffect,
  uniqueEffectCatalog,
  withUniqueEffects,
} from "../builds/build.unique";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import { BuildSummary } from "../builds/components/BuildSummary";
import { communityRequest, CommunityRequestError } from "./community.browser";
import {
  CommunityEmailConfirmation,
  readCommunityProfile,
} from "./CommunityEmailConfirmation";
import { communityBuildSchema, type CommunityBuild } from "./community.schema";
import { DescriptionContent } from "./RichDescription";

const groups = [
  { label: "Weapons", slots: ["melee", "ranged"], className: "weapon-slots" },
  {
    label: "Armor",
    slots: ["head", "torso", "legs", "feet"],
    className: "armor-slots",
  },
  {
    label: "Artifacts",
    slots: ["artifact1", "artifact2", "artifact3"],
    className: "trinket-slots artifact-slots",
  },
  {
    label: "Talismans",
    slots: ["talisman1", "talisman2", "talisman3"],
    className: "trinket-slots",
  },
] satisfies { label: string; slots: BuildSlot[]; className: string }[];

function CatalogLink({
  item,
  className,
  children,
  label,
  ...props
}: {
  item: CatalogItem;
  className: string;
  label?: string;
} & Omit<React.ComponentProps<"a">, "href">) {
  const path = itemPath(normalizeDetailItem(item)).split("/");
  // An innate effect without a catalog entry still has a readable tooltip.
  if (item.slug.startsWith("unique-effect:"))
    return (
      <span className={className} aria-label={label} tabIndex={0} title={label}>
        {children}
      </span>
    );
  return (
    <Link
      {...props}
      role="link"
      to="/catalog/$category/$slug"
      params={{ category: path[2], slug: path[3] }}
      search={{ returnTo: undefined, power: undefined }}
      className={className}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

export function CommunityEquipment({
  build,
  catalog,
}: {
  build: Build;
  catalog: ReadonlyMap<string, CatalogItem>;
}) {
  const resolved = withUniqueEffects(build, catalog);
  return (
    <div className="community-board build-board" aria-label="Build equipment">
      <div className="community-modifier-legend">
        <span>
          <Sparkles size={12} /> Enchantment
        </span>
        <span>
          <Square size={11} /> Effects
        </span>
        <span className="community-unique-legend">U · Unique effect</span>
      </div>
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="board-section-title">{group.label}</h2>
          <div className={group.className}>
            {group.slots.map((slot) => {
              const gear = resolved.slots[slot];
              const item = gear ? catalog.get(gear.itemSlug) : undefined;
              const fixed = uniqueEffect(item);
              const enchantment =
                gear && isGearSlot(slot) && gear.enchantments[0]
                  ? catalog.get(gear.enchantments[0])
                  : undefined;
              const modifiers = gear
                ? [
                    ...(enchantment
                      ? [
                          {
                            item: enchantment,
                            tier: selectedTier(
                              enchantment,
                              gear.enchantmentTier,
                              item?.category,
                            )?.tier,
                            kind: "enchantment",
                            unique: false,
                          },
                        ]
                      : []),
                    ...gear.effects.flatMap((slug, index) => {
                      const modifier = slug ? catalog.get(slug) : undefined;
                      const unique = index === 0 && !!fixed;
                      return modifier
                        ? [
                            {
                              item: modifier,
                              tier: unique
                                ? "unique"
                                : selectedTier(
                                    modifier,
                                    gear.effectTiers?.[index],
                                    item?.category,
                                  )?.tier,
                              kind: "effect",
                              unique,
                            },
                          ]
                        : [];
                    }),
                  ]
                : [];
              const tier =
                item?.category === "talisman"
                  ? selectedTier(item, gear?.itemTier, item.category)?.tier
                  : undefined;
              const content = (
                <>
                  <span className="gear-art">
                    <ItemArtwork item={item} />
                  </span>
                  <span className="gear-copy">
                    <span className="eyebrow">{slotRules[slot].label}</span>
                    <span className="gear-name">
                      {item?.variation ??
                        (gear ? "Unavailable item" : "Empty slot")}
                      {tier ? ` ${tier}` : ""}
                    </span>
                  </span>
                </>
              );
              return (
                <article className="community-gear gear-slot" key={slot}>
                  {item ? (
                    <CatalogLink item={item} className="gear-select">
                      {content}
                    </CatalogLink>
                  ) : (
                    <div className="gear-select community-empty-gear">
                      {content}
                    </div>
                  )}
                  {modifiers.length > 0 && (
                    <div className="gear-modifiers">
                      {modifiers.map((modifier, index) => {
                        const label = `${modifier.kind === "enchantment" ? "Enchantment" : modifier.unique ? "Unique effect" : "Effect"}: ${modifier.item.variation}${modifier.tier && modifier.tier !== "unique" ? ` · Tier ${modifier.tier}` : ""}`;
                        if (modifier.item.slug.startsWith("unique-effect:"))
                          return (
                            <span
                              key={`${modifier.kind}-${index}`}
                              className="modifier-button effect unique-effect"
                              title={label}
                              aria-label={label}
                              tabIndex={0}
                            >
                              <span className="modifier-art">
                                <ItemArtwork item={modifier.item} />
                              </span>
                              <span
                                className="modifier-tier"
                                aria-hidden="true"
                              >
                                U
                              </span>
                            </span>
                          );
                        return (
                          <CatalogLink
                            key={`${modifier.kind}-${index}`}
                            item={modifier.item}
                            label={label}
                            title={label}
                            className={`modifier-button ${modifier.kind} ${modifier.unique ? "unique-effect" : ""}`}
                          >
                            <span className="modifier-art">
                              <ItemArtwork item={modifier.item} />
                            </span>
                            {modifier.tier && (
                              <span
                                className="modifier-tier"
                                aria-hidden="true"
                              >
                                {modifier.tier === "unique"
                                  ? "U"
                                  : modifier.tier}
                              </span>
                            )}
                          </CatalogLink>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
export function CommunityBuildPage({ buildId }: { buildId: string }) {
  const [post, setPost] = useState<CommunityBuild>();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);
  const [checkingEdit, setCheckingEdit] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  const catalogMap = useMemo(() => uniqueEffectCatalog(catalog), [catalog]);
  useEffect(() => {
    let active = true;
    setPost(undefined);
    setError("");
    void communityRequest(`/${buildId}`)
      .then((data) => {
        if (active) setPost(communityBuildSchema.parse(data));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load build",
          );
      });
    void loadSessionCatalog()
      .then((items) => {
        if (active) setCatalog(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [buildId, attempt]);
  const openEditor = async () => {
    if (checkingEdit) return;
    setCheckingEdit(true);
    setError("");
    try {
      await communityRequest(`/${buildId}/edit`);
      await navigate({ to: "/community/$buildId/edit", params: { buildId } });
    } catch (cause) {
      if (cause instanceof CommunityRequestError && cause.status === 401) {
        setConfirmationEmail(readCommunityProfile()?.email ?? "");
        setConfirmationOpen(true);
      } else {
        setError(
          cause instanceof Error ? cause.message : "Could not open the editor.",
        );
      }
    } finally {
      setCheckingEdit(false);
    }
  };
  const openBuilder = async () => {
    if (!post || copying) return;
    setCopying(true);
    setError("");
    try {
      const db = getBuildCollections();
      await Promise.all([db.builds.preload(), db.preferences.preload()]);
      const now = new Date().toISOString();
      const copy = {
        ...structuredClone(post.build),
        id: crypto.randomUUID(),
        name: post.name,
        createdAt: now,
        updatedAt: now,
      };
      await db.builds.insert(copy).isPersisted.promise;
      await setWorkspace(db, { activeId: copy.id }).isPersisted.promise;
      await navigate({ to: "/build", search: {} });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save a local copy. Check browser storage.",
      );
    } finally {
      setCopying(false);
    }
  };
  if (!post)
    return (
      <div className="community-detail">
        <Link to="/community" className="community-back">
          <ArrowLeft size={15} />
          Community builds
        </Link>
        <div className="community-message" role={error ? "alert" : "status"}>
          <h2>{error ? "Build unavailable" : "Loading build…"}</h2>
          {error && (
            <>
              <p>{error}</p>
              <Button
                variant="secondary"
                onPress={() => setAttempt((value) => value + 1)}
              >
                Try again
              </Button>
            </>
          )}
        </div>
      </div>
    );
  return (
    <article className="community-detail">
      <Link to="/community" className="community-back">
        <ArrowLeft size={15} />
        Community builds
      </Link>
      <div className="community-detail-heading">
        <span className="eyebrow">COMMUNITY / BUILD</span>
        <h1>
          {post.name}
          <span className="accent">.</span>
        </h1>
        <div className="community-detail-meta">
          <div className="community-detail-author">
            <span className="muted">by {post.displayName}</span>
            {post.discord && (
              <span className="community-discord" title="Discord username">
                <DiscordIcon size={14} />
                <span className="sr-only">Discord: </span>
                {post.discord}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="community-open-builder"
            onPress={() => void openBuilder()}
            isPending={copying}
          >
            <Copy size={13} />
            Open in builder
          </Button>
        </div>
        <div className="community-tags">
          {post.tags.map((tag) => (
            <span className="community-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      <CommunityEquipment build={post.build} catalog={catalogMap} />
      <details className="community-summary">
        <summary>Effects & enchantments summary</summary>
        <BuildSummary
          build={withUniqueEffects(post.build, catalogMap)}
          catalog={catalogMap}
        />
      </details>
      <section className="community-description">
        <span className="eyebrow">CREATOR’S NOTES</span>
        <DescriptionContent value={post.description} />
      </section>
      <footer className="community-detail-footer">
        <span className="muted">
          Posted {new Date(post.createdAt * 1000).toISOString().slice(0, 10)}
          {post.updatedAt > post.createdAt
            ? ` · Updated ${new Date(post.updatedAt * 1000).toISOString().slice(0, 10)}`
            : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          isPending={checkingEdit}
          onPress={() => void openEditor()}
        >
          <Pencil size={14} />
          Edit this build
        </Button>
      </footer>
      {confirmationOpen && (
        <CommunityEmailConfirmation
          initialEmail={confirmationEmail}
          buildId={buildId}
          autoSend={!!confirmationEmail}
          onClose={() => setConfirmationOpen(false)}
          onVerified={async () => {
            await communityRequest(`/${buildId}/edit`);
            setConfirmationOpen(false);
            await navigate({
              to: "/community/$buildId/edit",
              params: { buildId },
            });
          }}
        />
      )}
    </article>
  );
}

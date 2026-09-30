export const displayNameKey = (name: string) =>
  name.trim().normalize("NFKC").toLowerCase();
export async function communityProfile(db: D1DatabaseSession, email: string) {
  return db
    .prepare("SELECT display_name FROM community_profiles WHERE email = ?")
    .bind(email)
    .first<{ display_name: string }>();
}
/** The unique indexes arbitrate simultaneous first posts; ownership is immutable. */
export async function claimDisplayName(
  db: D1DatabaseSession,
  email: string,
  name: string,
  now: number,
) {
  await db
    .prepare(
      "INSERT INTO community_profiles (email, display_name, name_key, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    )
    .bind(email, name.trim(), displayNameKey(name), now)
    .run();
  const profile = await communityProfile(db, email);
  if (!profile)
    return {
      error:
        "This display name belongs to another email. Choose a different display name.",
      fields: {
        displayName: "This display name belongs to another email.",
        email: "This email does not own that display name.",
      },
    };
  if (displayNameKey(profile.display_name) !== displayNameKey(name))
    return {
      error: "Display name does not match this verified email.",
      fields: {
        email: "This email is registered with a different display name.",
        displayName: `Use ${profile.display_name} for this email.`,
      },
    };
  return { displayName: profile.display_name };
}

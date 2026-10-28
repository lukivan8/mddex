# Move all local loadouts

A hosting change that retains exactly `https://mddex.net` keeps that browser's
localStorage origin. The separate Sites address has its own storage and cannot
read loadouts from the original address. A server database copy cannot copy
browser-local saves.

Use the same file transfer to move twenty or more loadouts between addresses,
browsers, or devices:

1. Open the source website in the browser/profile holding the loadouts.
2. Open **Saved loadouts** and choose **Export all loadouts**. Keep the JSON file.
3. Open **Saved loadouts** at the destination and choose **Choose backup**.
4. Review the loadout count, then choose **Import … loadouts**.

The original site needs the backup controls released before step 2 is available
there. The Sites copy and original-site feature use the same versioned format.

Files are generated and read entirely on the device. They are not uploaded,
shared, or included in telemetry. They contain names and complete loadouts, so
share the file only if you intend to share those builds.

The file preserves all variants, equipment references, powers, modifier tiers,
names and timestamps. Unknown catalog slugs remain intact. Import validates the
whole file before writing, then commits additions in one persisted collection
transaction. Existing loadouts and workspace selection are kept. Exact matches
are skipped; a conflicting ID becomes a deterministic imported copy. Repeating
an unchanged import does not create additional copies. A storage/quota failure
is reported as a failure and does not replace existing saves.

Backups support up to 5,000 loadouts and a 10 MB import limit. Unsupported file
versions, duplicate source IDs and malformed records are rejected. Legacy browser
backup keys are untouched. Resource tracker state is separate and is not part of
this loadout file. This feature transfers a snapshot; it does not add account sync.

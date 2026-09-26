# Changesets

Each change that users will notice gets a changeset: run `bun run changeset`, pick the bump (major, minor, or patch), and describe the change. Commit the file with the change.

At release time, `bun run version-packages` applies the changesets: it updates the version in `package.json` and writes `CHANGELOG.md`. Then `bun run release` builds and publishes.

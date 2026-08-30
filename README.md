# ShipSafe

**Check a project before you share it.**

ShipSafe catches common accidental leaks—environment files, API keys, private keys, local databases, personal computer paths, and generated junk—then creates a reviewed clean ZIP. It runs entirely in your browser and never modifies the original project.

## Why this exists

Project folders often collect files that should not leave your computer. A quick ZIP sent to GitHub, Discord, a client, or a collaborator can include `.env`, credentials, local databases, or thousands of generated dependency files.

ShipSafe makes the check visual and understandable for people who do not already use command-line secret scanners.

## Use it

1. Open ShipSafe in a modern browser.
2. Choose a project folder or ZIP.
3. Review every flagged file. Risky files start excluded.
4. Select **Create safe ZIP**.
5. Open and test the exported ZIP before sharing it.

There is no account, upload, analytics, or server-side file processing. The hosted build and a downloaded copy run the same code.

## What v1 checks

- `.env` files and common credential filenames
- private-key and certificate files
- recognizable GitHub, OpenAI, AWS, Stripe, Slack, and Discord credentials
- generic hard-coded credential assignments
- personal Windows, macOS, and Linux home-folder paths
- local databases and backup/editor files
- `.git`, `node_modules`, caches, virtual environments, and OS junk
- unsafe ZIP paths that try to leave the project folder

Detected credential values are never rendered in the report.

## Honest limitations

ShipSafe is a useful final check, not a security guarantee.

- It inspects text-like files up to 2 MB. Large and binary file contents are not interpreted.
- Pattern matching can miss unusual secrets and can produce false positives.
- Encrypted ZIPs are not supported.
- ZIPs with an exact root-level file named `__proto__` are rejected with instructions to rename it or select its containing folder. This avoids a ZIP-library filename limitation silently dropping that file. Export paths that normalize to this name are shown as `__proto__-file` in review; colliding export names receive suffixes. Nested names such as `project/__proto__` are preserved.
- Very large projects can exceed the browser's available memory during ZIP creation.
- Removing a leaked key from a ZIP does not make that key safe if it was already shared or committed. Rotate exposed credentials immediately.

Always review the exported archive and keep `.env` files out of version control.

## Development

```bash
npm install
npm run dev
```

Run the full quality check:

```bash
npm run check
```

The production build is written to `dist/`.

## Privacy and security

ShipSafe has no backend, telemetry, account system, advertisements, or third-party font requests. File bytes remain inside the browser tab. See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

MIT © Spotless

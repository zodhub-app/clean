<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="96" alt="ZodHub Pulse" />

# ZodHub Pulse

**Your machine, simply clean and safe.**

A maintenance and cleaning utility for **macOS and Windows**: direct, transparent and
100% local. It does the essentials — clear out caches, free up space, find duplicates,
uninstall properly, automate the boring parts — without the bloat and smoke of commercial
cleaners.

🇪🇸 [Leer en español](README.es.md)

[![Download for Mac](https://img.shields.io/badge/⬇%20Mac-Intel%20%2B%20Apple%20Silicon-0A84FF?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/zodhub-app/pulse/releases/latest)
[![Download for Windows](https://img.shields.io/badge/⬇%20Windows-10%20and%2011%20(64--bit)-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/zodhub-app/pulse/releases/latest)

![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)
![local-first](https://img.shields.io/badge/local--first-private-2ea44f)
[![Latest release](https://img.shields.io/github/v/release/zodhub-app/pulse?label=version)](https://github.com/zodhub-app/pulse/releases/latest)

</div>

---

<div align="center">
  <img src="docs/screenshot-resumen.png" alt="ZodHub Pulse — Home screen" width="860" />
  <br><em>Home: live telemetry, network radar and a process monitor.</em>
</div>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshot-memoria.png" alt="Memory" /><br><sub><b>Memory</b> — RAM pressure and a breakdown that explains itself.</sub></td>
    <td width="50%"><img src="docs/screenshot-tareas.png" alt="Tasks" /><br><sub><b>Tasks</b> — scheduled maintenance via launchd / Task Scheduler.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshot-ajustes.png" alt="Settings" /><br><sub><b>Settings</b> — themes, appearance and interface scale.</sub></td>
    <td width="50%"><img src="docs/screenshot-ds-store.png" alt=".DS_Store" /><br><sub><b>.DS_Store</b> — zip without junk files and sweep them away.</sub></td>
  </tr>
</table>

<div align="center"><sub>Plus: Storage, a large-file Explorer, APFS Snapshots, developer caches, an Uninstaller and a Duplicate finder.</sub></div>

---

## Download

Everything is on **[the latest release](https://github.com/zodhub-app/pulse/releases/latest)**.

| System | File | Notes |
| --- | --- | --- |
| **macOS** 12 or later | `..._universal.dmg` | One file for both Intel and Apple Silicon |
| **Windows** 10 and 11 (64-bit) | `..._x64-setup.exe` | Recommended |
| **Windows** (enterprise) | `..._x64_en-US.msi` | For group-policy deployment |

### First install

**macOS** — open the `.dmg`, drag the app into *Applications*, and the first time open it
with **right-click › Open**. Just that once.

**Windows** — run the installer. You'll see *"Windows protected your PC"*: click
**More info › Run anyway**. Also just the first time.

That notice appears on both systems because we don't yet sign with a paid certificate, not
because the program does anything odd. You can read the entire source in this repository
before trusting it, which is the only guarantee that really counts. From then on, the app
**updates itself** on both systems.

📖 **[Full install guide](docs/INSTALL.md)** — step by step for Mac and Windows, silent
install for administrators, how to verify your download, how to uninstall, and common
problems.

## What it does

- **Home** — live CPU, memory, disk and network usage, temperatures from available sensors
  and a process monitor.
- **Free up space** — junk that piles up: caches, temporary files, leftovers from
  development tools, Docker images and containers, AI models and the bin, each with its
  real measured size.
- **Storage** — what fills your disk, by volume and area, with a usage history.
- **Explorer** — finds the heaviest files and folders and reveals them in Finder or File
  Explorer, depending on the system.
- **Duplicates** — compares files by content (SHA-256 fingerprint), not by name.
- **Applications** — uninstalls programs and the files they leave behind. On Windows it
  calls each program's own official uninstaller rather than inventing one.
- **Memory** — RAM and swap detail, with an optional purge, honestly labelled as an
  approximation.
- **Tasks** — scheduled maintenance (daily, weekly or monthly) using `launchd` on macOS and
  Task Scheduler on Windows.
- **Snapshots** *(macOS only)* — lists and thins local Time Machine copies.
- **.DS_Store** *(macOS only)* — zips folders without those hidden files and sweeps them away.

Sections that make no sense on a given system **don't appear** there, rather than showing up
empty or pretending to do something.

## Principles

- **Honesty.** No absolute promises, no "antivirus" claims. If a value doesn't exist — say,
  a temperature sensor — it shows `—`, never a made-up number.
- **Private and local.** Everything runs on your machine. Zero telemetry; your data never
  leaves it. There are only two connections: checking for a new version and, if you ask for
  it, signing up for the newsletter.
- **Responsible deletion.** Deletions are previewed and confirmed; system paths are never
  touched.

## Automatic updates

ZodHub Pulse has a built-in updater. There's a **bell** in the top bar: when a new version
exists it lights up with a **red dot and a count**, and one click installs it (download,
**signature check**, install, restart). No reinstalling by hand.

It checks at startup and every 6 hours, and you can force a check from the bell itself. If
there's nothing new it says "You're up to date"; if it can't check — no connection — it says
so plainly instead of pretending everything is current.

It works the same on **macOS and Windows**: every release publishes a `latest.json` covering
both platforms, and the packages are cryptographically signed, so the updater rejects
anything that doesn't come from us.

## For developers

Requirements: Node 22+, Rust (rustup) and, depending on your system, the Xcode Command Line
Tools (macOS) or the Visual Studio Build Tools with the Windows SDK.

```bash
npm run bootstrap      # npm install + shadcn components
npm run tauri dev      # run in development
```

All the real logic (disk, network, system) lives in **Rust** (`src-tauri/src/*.rs`) as Tauri
commands; the frontend (React 19 + Tailwind v4 + shadcn/ui) only handles the interface.
Anything system-specific is isolated behind `#[cfg(target_os = ...)]` with a shared contract,
so the UI doesn't know which system it's on except to hide what doesn't apply.

To ship a new version, bump the number in `tauri.conf.json`, `Cargo.toml` and `package.json`,
then push a `vX.Y.Z` tag: CI builds the universal `.dmg` and the Windows installers, signs
them and creates a draft release with a `latest.json` covering both platforms.

The website in `landing/` is bilingual: the Spanish pages hold the translation dictionary and
`landing/build-en.py` regenerates `landing/en/` from it, so there is never a second copy of a
text to keep in sync.

## Stack

Tauri 2 · React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · Rust (sysinfo, walkdir, trash, sha2, zip)

## Licence

Proprietary software by ZodHub. You may use it free of charge and read its source; you may
not redistribute it or create derivative works. See [LICENSE](LICENSE),
[terms of use](https://zodhub-app.github.io/pulse/en/terminos.html) and
[privacy policy](https://zodhub-app.github.io/pulse/en/privacidad.html).

<div align="center"><sub>Made with care by <a href="https://github.com/zodhub-app">ZodHub</a> · Your machine, simply clean and safe.</sub></div>

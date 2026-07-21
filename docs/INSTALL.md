# Install guide — ZodHub Pulse

Everything you need to install and use ZodHub Pulse on **macOS** and **Windows**,
including what to do about the security warnings each system shows and how to check for
yourself that the file you downloaded is really ours.

> 🇪🇸 [Leer esta guía en español](INSTALACION.md)

---

## Contents

- [Choosing the right file](#choosing-the-right-file)
- [Installing on macOS](#installing-on-macos)
- [Installing on Windows](#installing-on-windows)
- [Automatic updates](#automatic-updates)
- [What each system does](#what-each-system-does)
- [Verifying your download](#verifying-your-download)
- [Uninstalling](#uninstalling)
- [Common problems](#common-problems)

---

## Choosing the right file

All files live on **[the latest release](https://github.com/zodhub-app/pulse/releases/latest)**,
under *Assets*.

| Your system | Download | Why |
| --- | --- | --- |
| macOS 12 (Monterey) or later | `ZodHub.Clean_x.y.z_universal.dmg` | A single file that works on both Intel and Apple Silicon |
| Windows 10 or 11, 64-bit | `ZodHub.Clean_x.y.z_x64-setup.exe` | The normal installer, and the recommended one |
| Windows in a company | `ZodHub.Clean_x.y.z_x64_en-US.msi` | For silent deployment via group policy |

You don't need to know which processor your Mac has: the `.dmg` is universal and works on
both.

On Windows, if you're unsure between `.exe` and `.msi`, take the `.exe`. The `.msi` only
makes sense if you administer several machines and deploy software centrally.

---

## Installing on macOS

1. Open the downloaded `.dmg`. A window appears with the app and a shortcut to *Applications*.
2. **Drag ZodHub Pulse into the Applications folder.**
3. The first time, **don't double-click it**: **right-click the app → Open**, then confirm
   with **Open** in the dialog.
4. Eject the `.dmg` window (the icon on your desktop or in the Finder sidebar).

From the second time onwards it opens with a double-click like any other app.

### Why it asks for the right-click

macOS shows *"cannot be opened because it is from an unidentified developer"* for any
application that hasn't been through Apple's **notarisation**, a paid process. It doesn't
mean the app is dangerous: it means Apple hasn't reviewed it. We haven't paid for that yet,
and we'd rather say so than gloss over it.

If the right-click doesn't work for you, there's a second route:
**System Settings → Privacy & Security →** scroll down to the notice about ZodHub Pulse
**→ Open Anyway**.

### Permissions it may ask for

The app requests access to specific folders when it needs them, not before:

- **Full Disk Access** — only if you want to scan folders outside your user account. You can
  refuse; the app carries on working with everything else.
- **Administrator privileges** — only for operations that genuinely require them, such as
  purging memory. The system dialog appears and you can cancel it.

---

## Installing on Windows

1. Run the `...-setup.exe` file you downloaded.
2. A blue screen will appear: **"Windows protected your PC"**.
   Click **More info** and then **Run anyway**.
3. Follow the installer. When it finishes you'll find ZodHub Pulse in the **Start menu**.

It takes about 12 MB installed.

### Why the blue notice appears

Windows SmartScreen warns about any program not signed with a paid **code-signing
certificate**, and also about ones that are signed but still have few downloads. The notice
isn't saying the program is harmful: it's saying Windows doesn't know it.

We haven't bought that certificate yet. Rather than asking you to take our word for it, we
give you two ways to check, explained under [Verifying your download](#verifying-your-download).

### Silent install (administrators)

With the `.msi`, to deploy without interaction:

```powershell
msiexec /i "ZodHub.Clean_x.y.z_x64_en-US.msi" /quiet /norestart
```

And to uninstall the same way:

```powershell
msiexec /x "ZodHub.Clean_x.y.z_x64_en-US.msi" /quiet /norestart
```

The app installs **per user**, needs no administrator rights to run, and installs no services
or background tasks beyond whatever the user schedules from the *Tasks* section.

---

## Automatic updates

These work identically on both systems and **nothing has to be reinstalled by hand**.

- The app checks for a new version **at startup and every 6 hours**.
- When there is one, the **bell** in the top bar lights up with a **red dot**.
- Clicking it shows the available version and its notes. One click on *Update now* downloads
  it, **verifies the cryptographic signature**, installs it and restarts the app.
- If there's nothing new it says *"You're up to date"*. If it can't check — no connection,
  for instance — it says so plainly rather than pretending everything is current.

You can also force a check from the bell itself.

### What that check sends

It only downloads a public file hosted on GitHub. As with any web request, GitHub receives
your IP address and the app version; we receive nothing and cannot tell who made the request.
If you'd rather avoid it, you can **turn automatic checking off** in *Settings* and update
manually from the website.

Every package is **cryptographically signed** with our key, so the updater rejects any file
that doesn't come from us.

---

## What each system does

Features that make no sense on a given system **don't appear** there. They aren't shown empty
and they don't pretend to do anything.

| Section | macOS | Windows | Notes |
| --- | :---: | :---: | --- |
| Home (live telemetry) | ✅ | ✅ | Temperature only where sensors are readable |
| Free up space | ✅ | ✅ | On Windows: temp files, browser caches, npm, pnpm, NuGet, Gradle, AI models and the Recycle Bin |
| Storage | ✅ | ✅ | The APFS volume breakdown is macOS-only |
| Explorer | ✅ | ✅ | Reveals in Finder or File Explorer as appropriate |
| Duplicates | ✅ | ✅ | Compares by content (SHA-256), not by filename |
| Applications | ✅ | ✅ | On Windows it reads the registry and calls each program's official uninstaller |
| Memory | ✅ | ✅ | Purging inactive memory exists on macOS only |
| Tasks | ✅ | ✅ | `launchd` on macOS, Task Scheduler on Windows |
| Snapshots | ✅ | — | Local Time Machine copies: an APFS-only concept |
| .DS_Store | ✅ | — | Those files are created by the macOS Finder |

---

## Verifying your download

You don't have to take our word for anything. There are three ways to check, from least to
most effort:

**1. Read the code.** The entire source is in
[this repository](https://github.com/zodhub-app/pulse). You can review exactly what the
program does, network requests included.

**2. Scan the file.** Upload the installer to
[VirusTotal](https://www.virustotal.com/gui/home/upload) and you'll see the verdict from more
than seventy antivirus engines.

**3. Compare the SHA-256 fingerprint** with the one published on the release page:

```bash
# macOS
shasum -a 256 ~/Downloads/ZodHub.Clean_0.2.0_universal.dmg
```

```powershell
# Windows
Get-FileHash .\ZodHub.Clean_0.2.0_x64-setup.exe -Algorithm SHA256
```

If the result matches, the file is exactly what we published and nobody altered it along the
way.

---

## Uninstalling

**macOS** — drag ZodHub Pulse from *Applications* to the Bin. Its preferences remain in
`~/Library/Application Support/com.viper.macup`; delete that folder if you want to leave no
trace. If you scheduled any tasks, remove them first from the *Tasks* section so no orphaned
`launchd` agents are left behind.

**Windows** — *Settings → Apps → Installed apps → ZodHub Pulse → Uninstall*. Its
preferences remain in `%APPDATA%\com.viper.macup`. As on macOS, it's worth disabling
scheduled tasks first.

---

## Common problems

**"The app is damaged and can't be opened" (macOS).**
This usually happens if the `.dmg` downloaded partially or if the browser applied the
quarantine attribute. Download it again from the releases page. If it persists, in Terminal:
`xattr -dr com.apple.quarantine /Applications/ZodHub\ Clean.app`.

**The Windows installer won't start.**
Check that the `-setup.exe` downloaded completely (the size should match the one on the
releases page) and that your Windows is 64-bit. On company-managed machines there may be a
policy blocking unsigned software; in that case, talk to whoever administers the machine.

**"Free up space" says some items were in use.**
That's normal and not a fault. Temporary folders always contain files open by other programs;
the app cleans everything else and tells you how many it left untouched. Close programs you
aren't using and run it again if you want to squeeze more out.

**Snapshots or .DS_Store don't show up.**
Correct: they only exist on macOS. See [What each system does](#what-each-system-does).

**The bell says "Couldn't check for updates".**
There's no internet connection, or a firewall is blocking access to GitHub. The app prefers
to say so rather than assume you're up to date.

---

Something this guide doesn't cover? Open an issue on
[the repository](https://github.com/zodhub-app/pulse/issues) or write to `info@zodhub.com`.

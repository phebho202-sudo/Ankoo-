# Mojere Market — Beginner setup guide

This guide gets the Mojere Market app running on your laptop and showing on
your phone. Do the parts **one at a time**. Each part ends with "What you
should see". If you see something different, take a screenshot and share it.

**Words you will meet**

- **Terminal**: a window where you type commands. On Windows it is called
  *PowerShell* or *Terminal*; on a Mac it is *Terminal*.
- **Command**: one line of text you paste into the terminal and press **Enter**.
- **Node.js**: the engine that runs the tools used to build the app.
- **Expo Go**: a free phone app that shows your app while it is being built.
- **Repository (repo)**: the project folder stored on GitHub.

---

## Part 1 — Install Node.js on your laptop (once)

1. Open your web browser and go to **nodejs.org**.
2. Click the big button that says **LTS** (version 22 or 24 is fine).
3. Open the downloaded file and click **Next** through the installer, keeping
   the default options.
4. Open a terminal:
   - **Windows**: press the Windows key, type `PowerShell`, press Enter.
   - **Mac**: press Cmd + Space, type `Terminal`, press Enter.
5. Paste this and press Enter:

   ```
   node -v
   ```

**What you should see:** a version number like `v22.13.0` or higher
(`v22.13` or newer, `v24` or `v26` all work). If it says
"not recognised" or "command not found", restart the laptop and try step 5 again.

## Part 2 — Install Git (once)

Git downloads the project from GitHub.

1. Go to **git-scm.com/downloads**, download for your system and install it
   with the default options. (On a Mac, typing `git --version` in Terminal
   offers to install it for you.)
2. In the terminal, paste `git --version` and press Enter.

**What you should see:** `git version 2.x.x`.

## Part 3 — Download the project (once)

1. In the terminal, paste these lines **one at a time**, pressing Enter after each:

   ```
   mkdir C:\dev
   cd C:\dev
   git clone https://github.com/phebho202-sudo/Ankoo-.git
   cd Ankoo-
   git checkout claude/great-carson-txy0xu
   cd mojere-market
   ```

   (GitHub may ask you to sign in. Use your GitHub account.)

On a Mac, use `mkdir ~/dev` and `cd ~/dev` for the first two lines instead.

We use `C:\dev` rather than the Desktop because developer tools can trip over
spaces in folder names (like a Windows username with spaces) and over the
Desktop being synced by OneDrive.

**What you should see:** no red error text. You now have the folder
`C:\dev\Ankoo-`, with `mojere-market` inside it.

## Part 4 — Install the app's building blocks (once, takes a few minutes)

In the same terminal (still inside `mojere-market`), paste:

```
npm install
```

**What you should see:** after a few minutes, a summary such as
`added 900 packages`. Some yellow "warn" lines are normal. A few "moderate
vulnerabilities" warnings are also expected: they come from the testing tools
and are not part of the app on your phone.

## Part 5 — Put Expo Go on your phones (once)

- **Android**: open the Play Store, search **Expo Go**, install.
- **iPhone**: open the App Store, search **Expo Go**, install. Also open the
  iPhone **Camera** app, which you will use to scan the QR code.

## Part 6 — Start the app

1. Make sure your laptop and phone are on the **same Wi-Fi network**.
2. In the terminal (inside `mojere-market`), paste:

   ```
   npm start
   ```

3. A large **QR code** appears in the terminal.
   - **Android**: open Expo Go → **Scan QR code** → point at the screen.
   - **iPhone**: open the Camera app → point at the QR code → tap the
     **Open in Expo Go** banner.

**What you should see:** the Mojere Market home screen with the green logo,
a yellow box saying **"Not connected to the database yet"**, the
**Sell an Item** and **Declutter My Home** buttons, and the category tiles.
That yellow box is correct for now: we connect Supabase in Phase 2.

**If the phone cannot connect** (common on public or office Wi-Fi), press
`Ctrl + C` in the terminal to stop, then run:

```
npx expo start --tunnel
```

and scan the new QR code. (The first time, it may ask to install an extra
helper called `@expo/ngrok`. Type `y` and press Enter.)

To stop the app at any time, click in the terminal and press `Ctrl + C`.

## Part 7 — Check everything is healthy (optional)

```
npm run check
```

**What you should see:** `Tests: 18 passed` at the end, with no red errors.

---

## Windows tips (lessons from the first setup)

- **"running scripts is disabled on this system"**: add `.cmd` to the command:
  `npm.cmd install`, `npm.cmd start`, `npx.cmd expo ...`. Everything else stays the same.
- **`ENOSPC: no space left on device`** means the C: drive is full. Check with `Get-PSDrive C`
  (look at **Free (GB)**). Keep at least 5 GB free, ideally 10 GB or more. Safe ways to free space:
  empty the Recycle Bin, run Windows **Disk Cleanup**, and `npm.cmd cache clean --force`.
  If an install failed half-way, delete the half-finished folder with
  `Remove-Item -Recurse -Force node_modules` (inside `mojere-market`) and install again.
- **Expo account**: Expo Go now needs you signed in to the **same free Expo account** on the phone
  (person icon in Expo Go) and on the laptop. If `npx.cmd expo login` crashes while opening the browser,
  use `npx.cmd expo login --no-browser` and type your email and password in PowerShell.
  Check with `npx.cmd expo whoami`.
- **"The request timed out" on the phone**: the Wi-Fi is blocking phone ↔ laptop traffic. Start the app with
  `npx.cmd expo start --tunnel` instead of `npm.cmd start`.

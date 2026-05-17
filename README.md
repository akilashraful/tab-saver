# 🗂️ TabSaver – Session Manager

**Free your browser memory by saving tabs, not your stress.**

TabSaver is a Chrome extension (Manifest V3) that lets you save all your open tabs into named sessions, close them to free RAM, and restore them later with one click.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Save Current Window** | Save all tabs from the active window into a named session |
| **Save All Windows** | Save every open tab across all browser windows |
| **Auto-Generated Names** | Sessions get smart names if you don't provide one |
| **Close After Saving** | Instantly free RAM by closing tabs right after saving |
| **One-Click Restore** | Open a session in the current window or a new window |
| **Open Individual Tabs** | Restore just one tab from a session without opening everything |
| **Search** | Find sessions and tabs by title or URL instantly |
| **Rename & Delete** | Manage sessions via the full-screen dashboard |
| **Auto-Save** | Periodically snapshot all open tabs automatically |
| **Export / Import** | Backup sessions as JSON and restore them anytime |
| **100% Local** | All data stays on your machine — no accounts, no servers |

---

## 📦 Installation (Developer Mode)

Since this extension is not published on the Chrome Web Store, you can load it manually in **under 60 seconds**:

### Step 1 – Download the extension files

Place the `tab-saver` folder somewhere permanent (e.g. `~/Extensions/tab-saver`).

> **Do not move or delete the folder after loading** — Chrome loads the extension directly from this folder.

### Step 2 – Open Chrome Extensions page

Open Chrome and go to:
```
chrome://extensions
```

### Step 3 – Enable Developer Mode

In the top-right corner of the Extensions page, toggle **Developer mode** ON.

### Step 4 – Load the extension

Click **"Load unpacked"** and select the `tab-saver` folder (the one containing `manifest.json`).

### Step 5 – Done! 🎉

The **TabSaver** icon will appear in your Chrome toolbar. Click it to start saving tabs.

> **Tip:** Pin the extension by clicking the puzzle-piece icon in the toolbar and pinning TabSaver.

---

## 🖥️ How to Use

### Saving Tabs (Popup)

1. Click the TabSaver icon in the toolbar
2. *(Optional)* Type a session name like `Work Research` or `Shopping`
3. Click **Save Current Window** or **Save All Windows**
4. *(Optional)* Check **"Close tabs after saving"** to free RAM immediately

### Managing Sessions (Dashboard)

Click the grid icon (⊞) in the popup header, or choose **"View All →"** to open the full dashboard.

From the dashboard you can:
- **Search** sessions and tabs by typing in the search bar
- **Filter** between All / Manual / Auto-Saved sessions
- **Expand** a session card to browse its individual tabs
- **Restore** a session (current window or new window)
- **Open** a single tab from within a session
- **Rename** a session with the pencil icon
- **Delete** a session with the trash icon

### Auto-Save

1. Open the dashboard → click **Settings** in the sidebar
2. Toggle **Auto-Save** ON
3. Choose an interval: 30 min, 1 hour, 6 hours, or daily
4. Auto-saved sessions appear with a ⏰ badge and are kept separate

### Export / Import

In Settings → **Export Backup** downloads a `.json` file with all your sessions.  
**Import Backup** merges sessions from a `.json` backup file (duplicates are skipped).

---

## 🔒 Privacy

- **No external servers.** Tab data never leaves your browser.
- **No accounts.** No sign-up required.
- **Minimal permissions.** The extension requests only:
  - `tabs` – to read open tab URLs and titles
  - `windows` – to identify and create windows
  - `storage` – to save sessions locally
  - `alarms` – for the auto-save interval timer

---

## 📁 File Structure

```
tab-saver/
├── manifest.json       ← Extension config (Manifest V3)
├── background.js       ← Service worker: save/restore/auto-save logic
├── popup.html          ← Quick-access popup UI
├── popup.css           ← Popup styles
├── popup.js            ← Popup JavaScript
├── dashboard.html      ← Full session management page
├── dashboard.css       ← Dashboard styles
├── dashboard.js        ← Dashboard JavaScript
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           ← You are here
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension doesn't appear in toolbar | Click the puzzle-piece icon and pin TabSaver |
| "Could not save session" error | Make sure there are non-chrome:// tabs open |
| Sessions lost after browser update | Check that the extension folder wasn't moved |
| Auto-save not triggering | Chrome may suspend service workers; re-toggle Auto-Save in Settings |
| Tabs won't close | Chrome requires at least one tab to remain open per window |

---

## 🔄 Updating

To update the extension after editing files:
1. Go to `chrome://extensions`
2. Find TabSaver and click the **↻ refresh** button

---

*Built with HTML, CSS, and JavaScript. No frameworks, no dependencies, no tracking.*

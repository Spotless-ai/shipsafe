# Try ShipSafe with a sample project

[Open the app](https://spotless-ai.github.io/shipsafe/) · [Download sample ZIP](https://github.com/Spotless-ai/shipsafe/raw/refs/heads/main/docs/first-trial/shipsafe-sample-project.zip)

Try scanning and exporting a project without using your own files. The sample contains five example files, including a dummy `.env` file with no real credentials.

1. Download the sample and choose **Open ZIP** in ShipSafe.
2. Read each finding and decide what belongs in the exported project.
3. Select **Create reviewed ZIP**.
4. Open the downloaded ZIP and inspect its contents. You do not need to execute any code.

## What to expect

ShipSafe flags three files and excludes them by default:

| File | Why it is flagged |
| --- | --- |
| `.env` | Environment file containing a dummy credential |
| `node_modules/example/index.js` | Dependency-folder example |
| `.DS_Store` | Operating-system junk example |

Leave these exclusions selected. The exported ZIP should contain only `README.md` and `src/hello.js`. Your original ZIP stays unchanged.

ShipSafe checks known patterns, so it can miss secrets and flag harmless values. It does not inspect binary contents. Always review the exported files before sharing a real project.

## Tell us how it went

If you try it, a reply with these three things is enough:

- Your browser and operating system.
- Whether you could finish scan → review → export → inspect, and where you got stuck.
- Whether the findings helped you decide what to share, and what was confusing.

[Open a GitHub issue](https://github.com/Spotless-ai/shipsafe/issues) or reply wherever you found ShipSafe. Please leave out private ZIPs, credentials and identifying screenshots. GitHub requires an account to submit an issue; ShipSafe does not require one to use the app.

## Walkthrough

![Open the sample ZIP, review three flagged files, and export the two remaining files](shipsafe-workflow.gif)

[Watch or download the 20-second MP4](shipsafe-workflow.mp4). An edited sequence of app screenshots shows the steps above.

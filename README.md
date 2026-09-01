# NUS CourseReg Vacancy & Demand Tracker 📊

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://coursereg-tracker.vercel.app/)
[![Vibecoded](https://img.shields.io/badge/Vibecoded%20with-Antigravity%20%26%20Gemini-7928CA?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

An interactive, responsive web application for NUS students to search course demand and vacancies, see oversubscription ratios, analyze historical competition trends, and compare metrics year-over-year.

🌐 **Live Website**: [https://coursereg-tracker.vercel.app/](https://coursereg-tracker.vercel.app/)

---

## 🌟 Key Features

- 🔍 **Instant Search & Autocomplete**: Search by module/course code (e.g., `CS2040C`, `AR2228`, `GEA1000`) or title.
- 📈 **Oversubscription Intelligence**: Instantly identify modules where `Demand > Vacancy`, with calculated competition ratios (e.g. `2.45x Oversubscribed`) and quota deficit metrics.
- 📅 **Year-over-Year Historical Comparison**:
  - Compare current round statistics with the **exact same round from the previous academic year** (e.g. AY26/27 Sem 1 Round 1 vs AY25/26 Sem 1 Round 1).
  - Visual side-by-side comparative charts powered by Chart.js.
- 🏫 **Class-Level Granularity**: View individual lecture and tutorial classes (D1, L1, etc.), showing actual quotas, timetable clashes, and workload limit rejections.
- 🎯 **Advanced Filtering**: Filter by Faculty/School, round view, and "Only Oversubscribed" courses.
- ⚡ **100% Static & Lightweight**: Pre-indexed client-side JSON database loads in milliseconds without any server or database required.

---

## 📁 Project Structure

```
nus-coursereg-tracker/
├── index.html                   # Main web application UI
├── style.css                    # Modern, responsive styling
├── app.js                       # Search, filtering, and Chart.js integration
├── parse_reports.py             # Python script to parse PDF vacancy reports into JSON
├── data/
│   ├── coursereg_data.json      # Indexed course database (generated)
│   └── metadata.json            # Available rounds, faculties, and summary
├── .github/workflows/
│   └── deploy.yml               # GitHub Actions for automated GitHub Pages deployment
└── README.md
```

---

## 🚀 How to Deploy to GitHub Pages

You can publish this project to GitHub Pages in under 2 minutes:

### Option A: Standard GitHub Pages Deployment (Recommended)
1. Initialize a git repository in this folder (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit of NUS CourseReg Tracker"
   ```
2. Create a new public repository on GitHub (e.g. `nus-coursereg-tracker`).
3. Link and push your repository:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/nus-coursereg-tracker.git
   git branch -M main
   git push -u origin main
   ```
4. On your GitHub repository page:
   - Go to **Settings** &rarr; **Pages** (in the left sidebar).
   - Under **Build and deployment** &gt; **Source**, select **Deploy from a branch**.
   - Select branch: `main` and folder: `/ (root)`.
   - Click **Save**.
5. Your site will be live at: `https://<YOUR_USERNAME>.github.io/nus-coursereg-tracker/` !

---

## 🔄 Adding New CourseReg PDF Reports in the Future

When NUS releases new CourseReg round vacancy reports:

1. Place the new PDF into your reports folder (e.g. `2627s2round_1.pdf`).
2. Run the parser script:
   ```bash
   python parse_reports.py
   ```
3. Commit and push the updated `data/coursereg_data.json` and `data/metadata.json` to GitHub. The live site will automatically update!

---

## 💻 Running Locally

To test locally without an internet connection:
```bash
# In this directory:
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## ⚡ Vibecoded Declaration

This project was 100% **vibecoded** using [Antigravity](https://deepmind.google/) & Google Gemini. From extracting and structuring official NUS PDF vacancy reports to enriching canonical faculty/grading data from the NUSMods API and crafting the real-time comparative Chart.js interface, the entire codebase was built interactively through agentic pair programming.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — feel free to use, modify, and distribute it for personal, academic, or open-source projects.

---

## 📜 Disclaimer
This project is an independent tool built for NUS students to make informed course registration decisions. All course data is parsed directly from official NUS CourseReg Demand & Allocation Reports. Not affiliated with or endorsed by the National University of Singapore (NUS).


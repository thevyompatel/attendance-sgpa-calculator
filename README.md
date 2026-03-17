# ATTENDANCE AND SGPA CALCULATOR

A portfolio-ready web dashboard for students to track attendance health and estimate SGPA in one place.

## Project Description
This project combines two practical academic tools into a single responsive interface:

- Attendance Calculator: checks current attendance, shows if you are above or below your target, estimates required recovery classes, and calculates safe bunk count.
- SGPA Calculator: computes weighted SGPA from marks and subject credits in real time.

Why it is useful:

- Helps students avoid attendance shortage risks.
- Gives quick SGPA estimates before official grade publication.
- Supports what-if planning for better semester decisions.

## Features

### Attendance Calculator
- Target attendance input (1 to 99).
- Inputs for scheduled, conducted, and present lectures.
- Real-time attendance percentage with circular progress ring.
- Dynamic status (at/above target or below target).
- Recovery mode: classes needed to reach target.
- Safety mode: maximum bunks while staying above target.
- End-term feasibility check based on remaining lectures.
- Quick helper button: Set Present to Target.
- Reset button for attendance values.

### SGPA Calculator
- Add and remove subject rows.
- Row inputs: marks (0 to 100) and credits (> 0).
- Auto grade-point preview per subject.
- Real-time weighted SGPA output.
- Smooth SGPA animation updates.
- Reset SGPA in one click.

### Dashboard Experience
- Responsive layout for desktop, tablet, and mobile.
- Light/Dark theme toggle.
- Local browser persistence using localStorage.

## Live Demo

Demo link: https://your-live-demo-link-here

## Installation

### Option 1: Direct Run (No setup)
1. Download or clone this repository.
2. Open the project folder.
3. Open index.html in a modern browser.

### Option 2: VS Code Live Server (Recommended)
1. Open the folder in VS Code.
2. Install the Live Server extension.
3. Right-click index.html.
4. Click **Open with Live Server**.

## Usage Guide

### Attendance Workflow
1. Enter target attendance percentage.
2. Enter scheduled, conducted, and present lectures.
3. Read the live status and insights:
   - current percentage
   - required classes to recover
   - safe bunks
   - final feasibility

Example:

- Target = 75
- Conducted = 50
- Present = 42
- Attendance = (42 / 50) x 100 = 84%

### SGPA Workflow
1. Add one row per subject.
2. Enter marks and credits for each row.
3. View per-subject grade point and final SGPA in the summary card.

Example:

| Subject | Marks | Credits | Grade Point | Credit x GP |
|---|---:|---:|---:|---:|
| Subject 1 | 80 | 3 | 8.00 | 24.00 |
| Subject 2 | 70 | 4 | 7.00 | 28.00 |
| Subject 3 | 50 | 2 | 5.00 | 10.00 |

Total Credits = 9  
SGPA = (24 + 28 + 10) / 9 = 6.89

## Technologies Used
- HTML5
- CSS3
- Vanilla JavaScript (ES6)

## Formulas Used

### Attendance Percentage
Attendance % = (Present / Conducted) x 100

### Classes Needed To Reach Target
Need = ceil((rC - P) / (1 - r))

Where:
- r = target ratio (75% means 0.75)
- C = conducted classes
- P = present classes

### Safe Bunks While Staying Above Target
Bunks = floor((P / r) - C)

### SGPA Calculation
Grade Point = (Marks / 100) x 10

SGPA = sum(Credit x GradePoint) / sum(Credit)

## Folder Structure

ATTENDANCE AND SGPA CALCULATOR/
- index.html
- style.css
- script.js
- README.md
- .gitignore
- assets/
    - screenshots/
        - .gitkeep

## Contribution Guidelines
Contributions are welcome.

1. Fork the repository.
2. Create a branch: feature/your-feature-name.
3. Make focused changes with clear commits.
4. Test on desktop and mobile.
5. Open a Pull Request with a concise summary.

Recommended before PR:
- Keep formatting consistent.
- Avoid unrelated file changes.
- Update README if behavior changes.

## Author
**Thevy**

If you use this project in a portfolio, add screenshots and a demo link for better presentation.

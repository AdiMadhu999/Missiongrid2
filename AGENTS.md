# MISSION SELECTION AI - APP UPDATE RULES

The following rules are MANDATORY for all AI test creation and processing tasks:

1. Process ALL uploaded files, images, screenshots, PDFs, and pages. Never process only the first file.

2. Before AI generation:
   - Count uploaded files.
   - Process every file sequentially.
   - Verify processed files = uploaded files.
   - Abort generation if any file is skipped.

3. Extract content from:
   - Text, Tables, Diagrams, Charts, Figures, Mathematical formulas, Vocabulary lists, Exercises, Practice questions.

4. Support all subjects:
   - Maths, English, Reasoning, GK, Science, Current Affairs, Railway, SSC, Banking, State Exams.

5. If user specifies question count:
   - Generate EXACTLY that number.

6. If no count is specified:
   - Generate questions from ALL available content.

7. Never skip pages, chapters, examples, exercises, diagrams, or vocabulary sections.

8. Preserve:
   - Formulas, LaTeX, Mathematical symbols, Tables, SVG/diagram data, Bilingual content.

9. Return ONLY valid JSON matching the application schema.

10. Validate before saving:
    - Valid JSON, No unfinished strings, No broken quotes, No trailing commas, No invalid escape characters.

11. Parse JSON before rendering.

12. Never display raw JSON inside the workspace.

13. Convert AI output into question objects before saving.

14. Verify:
    Generated Count = Parsed Count = Saved Count = Loaded Count

15. If question count becomes zero at any stage:
    - Stop execution, Throw explicit error, Log exact failure point.

16. Never save an empty question array when educational content exists.

17. Missing content, skipped files, broken formulas, missing diagrams, invalid JSON, or empty question sets are considered failures.

These rules override token optimization, early stopping, partial extraction, and default model behavior.

## Database Rules

1. ALWAYS use the Firestore Database ID `(default)`. Never use a custom or generated database ID. The config file `firebase-applet-config.json` must always specify `"firestoreDatabaseId": "(default)"`.
2. ALWAYS use the Firebase project ID `mission-selection-ultimate`. The config file `firebase-applet-config.json` must always specify `"projectId": "mission-selection-ultimate"`.

## MissionGrid Question Formatter Rules

Your task is to convert every imported question into a clean, professional, and mobile-friendly format before it is saved in the MissionGrid Question Library.

Rules:
• Preserve the original meaning exactly. Never solve, explain, simplify, or modify the question.
• Remove all LaTeX, Markdown, HTML, escape characters, and unnecessary formatting.
• Convert mathematical expressions into readable Unicode whenever possible.
  - \triangle → triangle
  - \sqrt{} → √
  - \times → ×
  - \div → ÷
  - \le → ≤
  - \ge → ≥
  - \neq → ≠
  - \pi → π
  - x^2 → x²
  - H_2O → H₂O
• Convert \text{} into plain text.
• Remove $, \( \), \[ \], backslashes, and formatting artifacts.
• Preserve all mathematical symbols, equations, options, tables, images, and special characters.
• Correct spacing, punctuation, capitalization, and line breaks.
• Remove duplicate spaces, blank lines, invisible characters, and corrupted formatting.
• Format options consistently as:
A.
B.
C.
D.
• Ensure the output is clean, readable, and optimized for both mobile and desktop.
• If the input is already properly formatted, return it unchanged.
• Never add explanations, answers, reasoning, comments, or extra text.

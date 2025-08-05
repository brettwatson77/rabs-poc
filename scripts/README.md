# Data Import & Management Toolkit  
`/scripts` Directory – Definitive Guide

This README is your one-stop reference for **ingesting, generating, inspecting and cleaning data** for the RABS-POC platform. It covers:

1. Overview of all available scripts  
2. Detailed usage instructions  
3. Common use-case examples  
4. Troubleshooting & FAQ  
5. Data format requirements  
6. Locating & preparing Excel files  
7. Safety features & best practices  
8. Expected data formats (Excel / CSV)  
9. Running tests & validating imports  
10. Tips for data cleanup & preparation  

---

## 1. Script Overview

| Script | Purpose | Typical Phase |
| ------ | ------- | ------------- |
| **import-excel-data.js** | Parse Excel/CSV/TXT exports and insert/update records in the database. | Initial data load / periodic sync |
| **convert-excel-to-json.js** | Quick inspection of spreadsheets → JSON + stats. | Data auditing / debugging |
| **find-excel-files.js** | Recursively locate candidate data files and preview their contents. | When you’re unsure where files were saved |
| **create-sample-data.js** | Generate realistic fake Staff & Participant records. | Development / demos / unit tests |

Each script is executable (`chmod +x`) and can also be run via `npm run` helpers defined in `package.json`.

---

## 2. Detailed Usage

### 2.1 `import-excel-data.js`

```
node scripts/import-excel-data.js --staff <file> --participants <file> [options]
```

Options | Description
--------|------------
`--staff <path>` | Path to Staff export (xlsx, csv, txt)
`--participants <path>` | Path to Participant export
`--dry-run` | Preview actions **without writing** to DB _(recommended first run)_
`--update` | Update existing matched rows instead of skipping
`--verbose` | Extra debug logging
`--help` | Show help

**Matching logic**

1. Participants: match by `ndis_number` if present, else *first+last name* plus one additional field (email, phone or full address).  
2. Staff: match by *first+last name* plus phone/email.

### 2.2 `convert-excel-to-json.js`

```
node scripts/convert-excel-to-json.js --input <file> [options]
```

Options | Description
--------|-------------
`--output <path>` | Save parsed JSON
`--limit <n>` | Preview first *n* rows (default 10)
`--stats` | Display per-column type analysis
`--full` | Dump all rows
`--pretty` | Pretty-print JSON
`--help` | Show help

Ideal for quickly verifying headers & values before importing.

### 2.3 `find-excel-files.js`

```
node scripts/find-excel-files.js [options]
```

Options | Description
--------|-------------
`--dir <path>` | Root directory to scan (default `cwd`)
`--keywords staff,participant,...` | Filter filenames (comma-list)
`--extensions xlsx,xls,csv,txt` | Extensions to consider
`--max-depth <n>` | Recursion depth (default 5)
`--preview / --no-preview` | Show content previews (default on)
`--show-all` | Ignore keyword filter
`--help` | Show help

The script prints suggested `import-excel-data` commands at the end.

### 2.4 `create-sample-data.js`

```
node scripts/create-sample-data.js [options]
```

Options | Description
--------|-------------
`--staff <n>` | Generate *n* staff (default 10)
`--participants <n>` | Generate *n* participants (default 20)
`--clean` | Purge existing Staff & Participant tables first
`--dry-run` | Preview without writing
`--verbose` | Extra logs
`--help` | Show help

---

## 3. Common Use-Case Examples

### Initial load with safe preview

```bash
npm run import-excel -- \
  --staff data/Staff_Active.xlsx \
  --participants data/Participants.xlsx \
  --dry-run --verbose
```

### Perform actual import after preview

```bash
npm run import-excel -- --staff data/Staff_Active.xlsx --participants data/Participants.xlsx
```

### Update records when monthly export arrives

```bash
npm run import-excel -- --staff exports/staff_aug.xlsx --update
```

### Generate 100 fake participants for UI QA

```bash
npm run seed            # Ensure base schema seeded
node scripts/create-sample-data.js --participants 100
```

### Find where those mysterious files went

```bash
npm run find-excel -- --dir ~/Downloads --keywords participant,staff
```

### Inspect a spreadsheet’s structure

```bash
node scripts/convert-excel-to-json.js --input exports/Participants.xlsx --stats --limit 5
```

---

## 4. Troubleshooting & FAQ

Problem | Possible Causes | Fix
--------|-----------------|----
`Error: File not found` | Wrong path / filename spaces | Quote the path or use absolute path
`Invalid participant data – postcode must be 4 digits` | Non-numeric postcode or extra spaces | Clean column (see §10)
Duplicate rows skipped | Record already exists & `--update` not used | Re-run with `--update` or adjust matching fields
“Unhandled error: password authentication failed” | `.env` DB credentials mismatch | Ensure `DATABASE_URL` correct
Import freezes on large file | Node memory | Use `--limit` with `convert-excel-to-json` first, split file, or increase Node heap (`NODE_OPTIONS=--max-old-space-size=4096`)
Date cells come through as numbers | Excel stores dates as serials | Format column as **Text** before export or convert via `convert-excel-to-json --stats`

---

## 5. Data Format Requirements

Field | Expected Format | Notes
------|-----------------|------
`first_name` / `last_name` | String | No numerals
`address` | `"<number> <street>"` | Free text ok
`suburb` | String | NSW suburbs recommended
`state` | `NSW` / `QLD` etc. | Defaults to `NSW`
`postcode` | 4-digit string/number | **Required for participants**
`ndis_number` | 9 digits | Optional but unique if present
`phone` | AU format | 02…, 04… accepted
`email` | Standard email regex | Optional
Boolean flags | `Yes/No`, `True/False`, `1/0` | Case-insensitive
Plan management | `Agency`, `Self`, `Plan` | Script normalises to enum

Missing optional columns are simply ignored.

---

## 6. Locating & Preparing Excel Files

1. **Locate**  
   ```bash
   npm run find-excel -- --dir ~/Downloads
   ```
2. **Check headers** with `convert-excel-to-json`.
3. **Rename** files logically (`Staff_Active.xlsx`, `Participants_July.xlsx`).
4. **Sanitise**: remove summary rows, pivot tables, empty columns.
5. If your system exported **tab-delimited `.txt`**: you can feed it directly; the importer detects `.txt`.

---

## 7. Safety Features & Best Practices

* **Dry-Run First** – always run with `--dry-run` on new datasets.  
* **Backups** – take a DB dump before large updates (`pg_dump` or copy `data/*.db`).  
* **Minimal Privileges** – run imports with a DB user limited to Staff/Participant tables.  
* **Source Control** – keep original exports in a `/data/raw` folder (git-ignored).  
* **Logging** – `--verbose` prints SQL IDs to help audit changes.  

---

## 8. Expected Data Formats

### Excel (`.xlsx` / `.xls`)
* First row **must** be headers.  
* Only first sheet is read – place data there or move unwanted sheets to the end.  
* Empty cells become `null`.  
* **Dates** should be stored as text (ISO `YYYY-MM-DD`) or they will arrive as serials.

### CSV / TXT
* Comma or **tab-delimited**.  
* Header line required.  
* UTF-8 encoding recommended.

---

## 9. Testing & Validation

1. **Unit Tests** – `test-system.js` covers CRUD operations; run with `node test-system.js`.  
2. **Dry-Run Preview** – importer prints table of actions.  
3. **After Import**  
   ```bash
   curl http://localhost:3000/api/participants | jq '. | length'
   ```  
   Ensure counts match.
4. **Database Spot Check**  
   ```sql
   SELECT first_name, last_name, plan_management_type
   FROM participants
   ORDER BY created_at DESC
   LIMIT 20;
   ```

---

## 10. Data Cleanup Tips

* Trim spaces in Excel (`=TRIM(A2)`) before exporting.  
* Convert “Yes”/“No” text to booleans via **Find & Replace** (`Yes` → `1`, `No` → `0`).  
* Check for duplicate NDIS numbers with Excel conditional formatting.  
* Use **Text to Columns** to split combined “Address, Suburb” cells.  
* Remove formulas – export values only. Formulas may appear as `null`.  
* Keep a changelog (`changes.md`) of manual fixes for repeatability.

---

### Happy Importing!  
For assistance, raise an issue or message the engineering channel.  
Remember: **Preview, Backup, then Import.**

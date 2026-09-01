import os
import re
import json
import glob
import time
from collections import defaultdict
import pdfplumber

def parse_int(val):
    if not val:
        return 0
    clean = str(val).replace(',', '').strip()
    try:
        return int(clean)
    except ValueError:
        return 0

def clean_str(val):
    if not val:
        return ""
    return re.sub(r'\s+', ' ', str(val)).strip()

FACULTY_MAP = {
    "Multi Disciplinary": "Multi Disciplinary Programme",
    "NUS Business": "NUS Business School",
    "SSH School of": "SSH School of Public Health",
    "School of": "School of Computing"
}

DEPT_MAP = {
    "Analytics and": "Analytics and Operations",
    "Centre for Future-ready": "Centre for Future-ready Grads",
    "Chua Thian Poh Comm": "Chua Thian Poh Comm Leader Ctr",
    "College of Alice & Peter": "College of Alice & Peter Tan",
    "Computing & Eng": "Computing & Eng Programme",
    "Ctr for Engl Lang": "Ctr for Engl Lang Comms",
    "Food Science &": "Food Science & Technology",
    "Management &": "Management & Organisation",
    "NUS College Dean's": "NUS College Dean's Office",
    "Pharmacy&Pharmaceut": "Pharmacy & Pharmaceutical Sciences",
    "Pharmacy&Pharmaceut icalScience": "Pharmacy & Pharmaceutical Sciences",
    "Ridge View Residential": "Ridge View Residential College",
    "SSH School of Public": "SSH School of Public Health DO",
    "Statistics and Data": "Statistics and Data Science"
}

def clean_faculty(fac):
    cleaned = clean_str(fac)
    return FACULTY_MAP.get(cleaned, cleaned)

def clean_dept(dept):
    cleaned = clean_str(dept)
    return DEPT_MAP.get(cleaned, cleaned)

def extract_meta_from_pdf(first_page_text, filename):
    round_match = re.search(r'Round\s*(\d+)', first_page_text, re.IGNORECASE)
    sem_match = re.search(r'Semester\s*(\d+)', first_page_text, re.IGNORECASE)
    ay_match = re.search(r'AY\s*(\d{4}[/-]\d{4})', first_page_text, re.IGNORECASE)

    fn_match = re.search(r'(\d{2})(\d{2})s(\d)round_?(\d)', filename, re.IGNORECASE)
    
    round_num = int(round_match.group(1)) if round_match else (int(fn_match.group(4)) if fn_match else 1)
    sem_num = int(sem_match.group(1)) if sem_match else (int(fn_match.group(3)) if fn_match else 1)
    
    if ay_match:
        ay_str = ay_match.group(1).replace('-', '/')
    elif fn_match:
        y1 = 2000 + int(fn_match.group(1))
        y2 = 2000 + int(fn_match.group(2))
        ay_str = f"{y1}/{y2}"
    else:
        ay_str = "AY2026/2027"

    period_key = f"{ay_str}_S{sem_num}_R{round_num}"
    return {
        "ay": ay_str,
        "semester": sem_num,
        "round": round_num,
        "key": period_key,
        "label": f"{ay_str} Sem {sem_num} (Round {round_num})"
    }

def process_pdf(pdf_path):
    filename = os.path.basename(pdf_path)
    print(f"Processing: {filename}...")
    t0 = time.time()
    
    with pdfplumber.open(pdf_path) as pdf:
        num_pages = len(pdf.pages)
        p1_text = pdf.pages[0].extract_text() or ""
        meta = extract_meta_from_pdf(p1_text, filename)
        
        records = []
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                continue
            for table in tables:
                for row in table:
                    if not row or len(row) < 7:
                        continue
                    code_cell = clean_str(row[2])
                    if not code_cell or code_cell.lower() == 'course' or 'code' in code_cell.lower():
                        continue
                    
                    faculty = clean_faculty(row[0])
                    dept = clean_dept(row[1])
                    course_code = code_cell.upper()
                    course_title = clean_str(row[3])
                    course_class = clean_str(row[4])
                    
                    vacancy = parse_int(row[5])
                    demand = parse_int(row[6])
                    alloc_main = parse_int(row[7]) if len(row) > 7 else 0
                    alloc_reserve = parse_int(row[8]) if len(row) > 8 else 0
                    unalloc_quota = parse_int(row[9]) if len(row) > 9 else 0
                    unalloc_clash = parse_int(row[10]) if len(row) > 10 else 0
                    unalloc_workload = parse_int(row[11]) if len(row) > 11 else 0
                    unalloc_others = parse_int(row[12]) if len(row) > 12 else 0

                    records.append({
                        "faculty": faculty,
                        "dept": dept,
                        "code": course_code,
                        "title": course_title,
                        "class": course_class,
                        "vacancy": vacancy,
                        "demand": demand,
                        "alloc_main": alloc_main,
                        "alloc_reserve": alloc_reserve,
                        "unalloc_quota": unalloc_quota,
                        "unalloc_clash": unalloc_clash,
                        "unalloc_workload": unalloc_workload,
                        "unalloc_others": unalloc_others
                    })
                    
        print(f"  Extracted {len(records)} class rows across {num_pages} pages in {time.time()-t0:.2f}s ({meta['label']})")
        return meta, records

def build_database(pdf_folder, output_dir):
    pdf_files = sorted(glob.glob(os.path.join(pdf_folder, "*.pdf")))
    print(f"Found {len(pdf_files)} PDF files in {pdf_folder}")

    courses_db = {}
    periods_meta = []
    seen_periods = set()
    faculties = set()
    departments = set()

    for pdf_file in pdf_files:
        meta, records = process_pdf(pdf_file)
        period_key = meta["key"]
        if period_key not in seen_periods:
            seen_periods.add(period_key)
            periods_meta.append(meta)

        period_course_agg = defaultdict(lambda: {
            "vacancy": 0,
            "demand": 0,
            "alloc_main": 0,
            "alloc_reserve": 0,
            "unalloc_quota": 0,
            "unalloc_clash": 0,
            "unalloc_workload": 0,
            "unalloc_others": 0,
            "classes": []
        })

        for r in records:
            code = r["code"]
            fac = r["faculty"]
            dept = r["dept"]
            title = r["title"]
            
            if fac: faculties.add(fac)
            if dept: departments.add(dept)

            if code not in courses_db:
                courses_db[code] = {
                    "code": code,
                    "title": title,
                    "faculty": fac,
                    "dept": dept,
                    "history": {}
                }
            else:
                if title and not courses_db[code]["title"]:
                    courses_db[code]["title"] = title
                if fac and not courses_db[code]["faculty"]:
                    courses_db[code]["faculty"] = fac
                if dept and not courses_db[code]["dept"]:
                    courses_db[code]["dept"] = dept

            agg = period_course_agg[code]
            agg["vacancy"] += r["vacancy"]
            agg["demand"] += r["demand"]
            agg["alloc_main"] += r["alloc_main"]
            agg["alloc_reserve"] += r["alloc_reserve"]
            agg["unalloc_quota"] += r["unalloc_quota"]
            agg["unalloc_clash"] += r["unalloc_clash"]
            agg["unalloc_workload"] += r["unalloc_workload"]
            agg["unalloc_others"] += r["unalloc_others"]
            agg["classes"].append({
                "class": r["class"],
                "vac": r["vacancy"],
                "dem": r["demand"],
                "main": r["alloc_main"],
                "res": r["alloc_reserve"],
                "quota": r["unalloc_quota"],
                "clash": r["unalloc_clash"],
                "wl": r["unalloc_workload"],
                "oth": r["unalloc_others"]
            })

        for code, agg_data in period_course_agg.items():
            vac = agg_data["vacancy"]
            dem = agg_data["demand"]
            ratio = round(dem / vac, 2) if vac > 0 else (999.0 if dem > 0 else 0.0)
            diff = dem - vac
            oversubscribed = dem > vac

            courses_db[code]["history"][period_key] = {
                "period": period_key,
                "ay": meta["ay"],
                "semester": meta["semester"],
                "round": meta["round"],
                "label": meta["label"],
                "vacancy": vac,
                "demand": dem,
                "ratio": ratio,
                "diff": diff,
                "oversubscribed": oversubscribed,
                "alloc_main": agg_data["alloc_main"],
                "alloc_reserve": agg_data["alloc_reserve"],
                "unalloc_quota": agg_data["unalloc_quota"],
                "unalloc_clash": agg_data["unalloc_clash"],
                "unalloc_workload": agg_data["unalloc_workload"],
                "unalloc_others": agg_data["unalloc_others"],
                "classes": agg_data["classes"]
            }

    def period_sort_key(p):
        ay_start = int(p["ay"].split("/")[0][-4:])
        return (ay_start, p["semester"], p["round"])

    periods_meta.sort(key=period_sort_key)

    os.makedirs(output_dir, exist_ok=True)
    
    data_output = os.path.join(output_dir, "coursereg_data.json")
    with open(data_output, "w", encoding="utf-8") as f:
        json.dump(courses_db, f, separators=(',', ':'))
    print(f"Saved {len(courses_db)} courses to {data_output} ({os.path.getsize(data_output) / 1024:.1f} KB)")

    meta_output = os.path.join(output_dir, "metadata.json")
    with open(meta_output, "w", encoding="utf-8") as f:
        json.dump({
            "total_courses": len(courses_db),
            "periods": periods_meta,
            "faculties": sorted(list(faculties)),
            "departments": sorted(list(departments)),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, indent=2)
    print(f"Saved metadata to {meta_output}")

if __name__ == "__main__":
    PDF_FOLDER = r"C:\Users\stamp\Downloads\Course Vacancy Reports"
    OUTPUT_DIR = r"C:\Users\stamp\.gemini\antigravity\scratch\nus-coursereg-tracker\data"
    build_database(PDF_FOLDER, OUTPUT_DIR)
    print("\n--- Running NUSMods API Canonical Enrichment ---")
    try:
        import subprocess
        import sys
        script_dir = os.path.dirname(os.path.abspath(__file__))
        enrich_script = os.path.join(script_dir, "enrich_from_nusmods.py")
        subprocess.run([sys.executable, enrich_script], check=True)
    except Exception as e:
        print(f"Enrichment note: {e}")


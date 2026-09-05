import urllib.request
import json
import os
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
data_path = os.path.join(DATA_DIR, "coursereg_data.json")
meta_path = os.path.join(DATA_DIR, "metadata.json")

print("Reading coursereg_data.json...")
with open(data_path, "r", encoding="utf-8") as f:
    courses = json.load(f)

# Download NUSMods module info
nusmods_info = {}
years = ['2023-2024', '2024-2025', '2025-2026', '2026-2027']

for yr in years:
    url = f"https://api.nusmods.com/v2/{yr}/moduleInformation.json"
    print(f"Fetching {yr} from NUSMods...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'NUSCourseRegTracker/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            modules = json.loads(resp.read().decode('utf-8'))
            for m in modules:
                code = m.get('moduleCode')
                if not code:
                    continue
                attrs = m.get('attributes', {})
                is_su = bool(attrs.get('su', False))
                grading_desc = m.get('gradingBasisDescription', '')
                is_cscu = 'Completed Satisfactory' in grading_desc
                credits_val = m.get('moduleCredit')

                nusmods_info[code] = {
                    "faculty": m.get('faculty', '').strip(),
                    "dept": m.get('department', '').strip(),
                    "title": m.get('title', '').strip(),
                    "su": is_su,
                    "cscu": is_cscu,
                    "credits": credits_val
                }
            print(f"  Total unique NUSMods modules so far: {len(nusmods_info)}")
    except Exception as e:
        print(f"  Could not load {yr}: {e}")

# Enrich courses database
matched = 0
su_count = 0
cscu_count = 0

all_faculties = set()
all_depts = set()

for code, c in courses.items():
    info = nusmods_info.get(code)
    if info:
        matched += 1
        # Overwrite with canonical faculty & department from NUSMods
        if info['faculty']:
            c['faculty'] = info['faculty']
        if info['dept']:
            c['dept'] = info['dept']
        if info['title'] and not c.get('title'):
            c['title'] = info['title']
        c['su'] = info['su']
        c['cscu'] = info['cscu']
        c['credits'] = info['credits']
    else:
        # Defaults if not in NUSMods
        c.setdefault('su', False)
        c.setdefault('cscu', False)
        c.setdefault('credits', None)

    history_sems = set()
    for period_key in c.get('history', {}):
        if '_S1_' in period_key:
            history_sems.add(1)
        if '_S2_' in period_key:
            history_sems.add(2)

    if 1 in history_sems and 2 in history_sems:
        c['sem_offered'] = 'both'
    elif 1 in history_sems:
        c['sem_offered'] = 'sem1'
    elif 2 in history_sems:
        c['sem_offered'] = 'sem2'
    else:
        c['sem_offered'] = 'unknown'

    if c.get('su'):
        su_count += 1
    if c.get('cscu'):
        cscu_count += 1

    if c.get('faculty'):
        all_faculties.add(c['faculty'])
    if c.get('dept'):
        all_depts.add(c['dept'])

print(f"\nEnrichment results:")
print(f"  Matched {matched}/{len(courses)} courses against NUSMods API ({matched/len(courses)*100:.1f}%)")
print(f"  SUable courses: {su_count}")
print(f"  CS/CU courses: {cscu_count}")
print(f"  Total canonical faculties: {len(all_faculties)}")
print(f"  Total canonical departments: {len(all_depts)}")

# Save updated coursereg_data.json
with open(data_path, "w", encoding="utf-8") as f:
    json.dump(courses, f, separators=(',', ':'))

# Update metadata.json
with open(meta_path, "r", encoding="utf-8") as f:
    meta = json.load(f)

meta['faculties'] = sorted(list(all_faculties))
meta['departments'] = sorted(list(all_depts))
meta['su_count'] = su_count
meta['cscu_count'] = cscu_count
meta['last_updated'] = time.strftime("%Y-%m-%d %H:%M:%S")

with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)

print("Saved enriched data to coursereg_data.json and metadata.json successfully!")


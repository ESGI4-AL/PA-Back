import os
import json
import time
from itertools import combinations
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import direct des fonctions de similarité
from checker_text import calculate_similarity as calc_text
from checker_code import calculate_similarity as calc_code

# Paramètres
TEXT_EXTENSIONS = {'.txt', '.md', '.rst'}
CODE_EXTENSIONS = {'.py', '.java', '.js', '.ts', '.html', '.xml', '.json', '.yaml', '.yml', '.properties'}
EXCLUDED_DIRS = {'node_modules', 'dist', 'build', '__pycache__', 'venv', '.env', 'env', 'target'}
EXCLUDED_EXTENSIONS = {'.lock', '.log', '.zip', '.exe', '.class'}
MIN_LINES = 1
MAX_WORKERS = 5

def list_files_by_type(root_path):
    files = []
    for root, dirs, filenames in os.walk(root_path):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in filenames:
            full_path = os.path.join(root, f)
            ext = os.path.splitext(f)[1].lower()
            if ext in EXCLUDED_EXTENSIONS:
                continue
            try:
                with open(full_path, 'r', encoding='utf-8') as file:
                    if len(file.readlines()) < MIN_LINES:
                        continue
            except Exception:
                continue
            if ext in TEXT_EXTENSIONS:
                files.append((full_path, 'text'))
            elif ext in CODE_EXTENSIONS:
                files.append((full_path, 'code'))
    return files

def read_file_content(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception:
        return None

def compare_files(file1, file2, type_):
    content1 = read_file_content(file1)
    content2 = read_file_content(file2)
    if content1 is None or content2 is None:
        return None
    try:
        if type_ == "text":
            return calc_text(content1, content2)
        elif type_ == "code":
            return calc_code(content1, content2)
    except Exception:
        return None
    return None

def compare_projects(proj1, proj2):
    files1 = list_files_by_type(proj1)
    files2 = list_files_by_type(proj2)
    max_similarity = 0.0
    tasks = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for path1, type1 in files1:
            for path2, type2 in files2:
                if type1 == type2:
                    tasks.append(executor.submit(compare_files, path1, path2, type1))
        for future in as_completed(tasks):
            sim = future.result()
            if sim and sim > max_similarity:
                max_similarity = sim
    return max_similarity

def compare_all_projects(base_dir):
    project_dirs = [os.path.join(base_dir, d) for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
    project_names = [os.path.basename(p) for p in project_dirs]
    compared = set()
    exclusion_tracker = defaultdict(int)
    suspicion_groups = []
    pair_scores = {}
    max_scores = {}
    max_similarity_global = 0.0

    for proj1, proj2 in combinations(project_names, 2):
        if (proj1, proj2) in compared or (proj2, proj1) in compared:
            continue
        path1 = os.path.join(base_dir, proj1)
        path2 = os.path.join(base_dir, proj2)
        similarity = compare_projects(path1, path2)
        pair_scores[(proj1, proj2)] = similarity
        compared.add((proj1, proj2))

        if similarity > max_similarity_global:
            max_similarity_global = similarity

        if similarity >= 0.9:
            found = False
            for group in suspicion_groups:
                if proj1 in group or proj2 in group:
                    group.update([proj1, proj2])
                    found = True
                    break
            if not found:
                suspicion_groups.append(set([proj1, proj2]))
        elif similarity >= 0.75:
            for group in suspicion_groups:
                if proj1 in group or proj2 in group:
                    group.update([proj1, proj2])
                    break
            else:
                suspicion_groups.append(set([proj1, proj2]))

        for proj in [proj1, proj2]:
            if proj not in max_scores or similarity > max_scores[proj][0]:
                max_scores[proj] = (similarity, proj1 if proj == proj2 else proj2)

        if similarity < 0.5:
            exclusion_tracker[proj1] += 1
            exclusion_tracker[proj2] += 1

    result = []
    added_projects = set()
    total_projects = len(project_names)
    threshold = int(0.75 * (total_projects - 1))

    for group in suspicion_groups:
        group_list = list(group)
        scores = [
            pair_scores.get((a, b), pair_scores.get((b, a), 0.0))
            for a in group for b in group if a != b
        ]
        max_score = max(scores) if scores else 0.0
        result.append({
            "group": group_list,
            "max_similarity": max_score,
            "status": "triche très probable" if max_score >= 0.9 else "forte similarité"
        })
        added_projects.update(group_list)

    for proj in project_names:
        if proj in added_projects:
            continue
        if exclusion_tracker[proj] >= threshold:
            result.append({
                "project": proj,
                "status": "non suspecté",
                "excluded_after": exclusion_tracker[proj],
                "reason": "Peu de similarité avec 75% des autres projets (< 0.5)"
            })
        else:
            sim, match = max_scores.get(proj, (0.0, None))
            if match:
                result.append({
                    "project": proj,
                    "matched_with": match,
                    "similarity_max": sim,
                    "status": "projet isolé avec correspondance"
                })

    output_path = os.path.join(base_dir, "rapport_global.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "max_similarity_overall": max_similarity_global,
            "comparisons": result
        }, f, indent=2, ensure_ascii=False)

    print(f"Rapport généré : {output_path}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage : python compare_all_projects.py <chemin_du_dossier_de_projets>")
        exit(1)
    start = time.time()
    compare_all_projects(sys.argv[1])
    end = time.time()
    print(f"\nemps total d'exécution : {end - start:.2f} secondes")
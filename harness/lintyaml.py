"""Parse every workflow file. A workflow that does not parse fails the whole run before
any job starts, and GitHub reports it with no job and no annotation, so catch it here.

  python3 harness/lintyaml.py
"""
import pathlib, sys

try:
    import yaml
except ImportError:
    sys.exit("pyyaml is required: pip install pyyaml")

ROOT = pathlib.Path(__file__).resolve().parent.parent
bad = 0
for f in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
    try:
        doc = yaml.safe_load(f.read_text())
        jobs = list(doc.get("jobs", {}))
        print("  ok   %-24s jobs: %s" % (f.name, ", ".join(jobs)))
        for name, job in doc.get("jobs", {}).items():
            for step in job.get("steps", []):
                if not (step.get("run") or step.get("uses")):
                    print("  WARN %s/%s has a step with neither run nor uses" % (f.name, name))
    except yaml.YAMLError as e:
        bad += 1
        mark = getattr(e, "problem_mark", None)
        where = " line %d col %d" % (mark.line + 1, mark.column + 1) if mark else ""
        print("  FAIL %-24s %s%s" % (f.name, getattr(e, "problem", e), where))
sys.exit(1 if bad else 0)

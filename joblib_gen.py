import joblib
import os

def generate_joblib():
    # Folder where your txt files are stored
    path = os.getcwd()
    folder = f"{path}/data"  # adjust this to your path

    # Output file
    joblib_file = "triples.joblib"

    # Check if already exists
    if os.path.exists(joblib_file):
        print(f"{joblib_file} already exists, skipping build.")
    else:
        print("Building triples set...")
        files = [
            os.path.join(folder, "wikidata5m_transductive_train.txt"),
            os.path.join(folder, "wikidata5m_transductive_valid.txt"),
            os.path.join(folder, "wikidata5m_transductive_test.txt")
        ]
        triples = set()
        for file in files:
            with open(file, "r", encoding="utf-8") as f:
                for line in f:
                    h, r, t = line.strip().split()
                    triples.add((h, r, t))
        
        # Save to .joblib
        joblib.dump(triples, joblib_file)
        print(f"Saved {len(triples):,} triples to {joblib_file}")

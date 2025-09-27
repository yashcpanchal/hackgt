from fastapi import FastAPI
from pydantic import BaseModel
import joblib
from joblib_gen import generate_joblib
from wiki_llm import fetch_wikipedia_pages, build_faiss_index, chunk_text, query_index
import os
from openai import OpenAI
from sentence_pre import compute_triplets

app = FastAPI(title="Fact Checker API")

triples = set()  # global variable


def run_wiki_llm(claim, subject):
    
    build_faiss_index(subject, top_k=2)
    results = query_index(claim, k=1)
    context = ""
    for r in results:
        context += r['text']

    client = OpenAI()

    prompt = f"""
    Claim: "{claim}"
    Context:
    {context}

    Is the claim true, false, or not supported? Answer with one word.
    """

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return resp.choices[0].message.content

# @app.on_event("startup")
# def load_triples():
#     global triples
#     joblib_file = "triples.joblib"
#     if not os.path.exists(joblib_file):
#         print("Joblib file not found, generating...")
#         generate_joblib()
#     print("Loading triples into memory...")
#     triples = joblib.load(joblib_file)
#     print(f"Loaded {len(triples):,} triples.")

@app.post("/check_fact")
def check_fact(sentence, k=5):
    triplet = compute_triplets(sentence, k)
    # if triplet[1] is None:
    return run_wiki_llm("Donald Trump", sentence)
    # else:
    #     exists = triplet in triples
    #     if exists == True:
    #         return True 
    #     else:
    #         return run_wiki_llm("Donald Trump", "Donald trump was born in 1976")

@app.get("/")
def root():
    return {"message": "Fact Checker API is running"}


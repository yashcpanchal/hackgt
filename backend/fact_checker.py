from fastapi import FastAPI, File, UploadFile, Form
from pydantic import BaseModel
import joblib
from joblib_gen import generate_joblib
from wiki_llm import FaissIndex
import os
from openai import OpenAI
from sentence_pre import compute_triplets, get_openai_client, extract_k_text_triplets, is_claim, extract_subject
import json
import PyPDF2
import io

app = FastAPI(title="Fact Checker API")

def fact_check_with_context(claim: str, context: str):
    client = OpenAI()

    prompt = f"""
    Claim: "{claim}"
    Context:
    {context}

    Based *solely* on the provided Context, is the Claim true, false, or not supported?
    If the information needed to determine the truthfulness of the Claim is *not present* in the Context, you *must* respond with "not supported". Do not use any outside knowledge.

    Respond with a JSON object with four keys: "answer" (true, false, or not supported), "confidence" (a score from 0 to 5, where 5 is very confident), "is_false" (boolean), and "snippet" (the exact text snippet from the Context that was used to make the determination. If the answer is "not supported", the snippet should be an empty string).
    """

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}]
    )
    
    response_data = resp.choices[0].message.content
    try:
        response_json = json.loads(response_data)
        return response_json
    except json.JSONDecodeError:
        return {
            "answer": "not supported",
            "confidence": 0,
            "is_false": False,
            "snippet": ""
        }

def fact_check_with_wikipedia(claim, subject):
    faiss_index = FaissIndex()
    faiss_index.build_index_from_wikipedia(subject, top_k=2)
    results = faiss_index.query(claim, k=1)
    context = ""
    sources = []
    for r in results:
        context += r['text']
        sources.append({
            "name": r['title'],
            "link": f"https://en.wikipedia.org/wiki/{r['title'].replace(' ', '_')}"
        })

    response = fact_check_with_context(claim, context)
    response["sources"] = sources
    return response

def extract_text_from_pdf(file: UploadFile):
    text = ""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file.file.read()))
        for page_num in range(len(pdf_reader.pages)):
            text += pdf_reader.pages[page_num].extract_text()
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

@app.post("/check_fact")
def check_fact(sentence, k=5):
    client = get_openai_client()
    if is_claim(sentence, client) == False:
        return {
            "answer": "not a checkable statement",
            "confidence": 0,
            "is_false": False,
            "sources": [],
            "snippet": ""
        }

    subject = extract_subject(sentence, client)
    return fact_check_with_wikipedia(claim=sentence, subject=subject)

@app.post("/check_fact_with_pdf")
async def check_fact_with_pdf(sentence: str = Form(...), file: UploadFile = File(...)):
    client = get_openai_client()
    if is_claim(sentence, client) == False:
        return {
            "answer": "not a checkable statement",
            "confidence": 0,
            "is_false": False,
            "sources": [],
            "snippet": ""
        }

    pdf_text = extract_text_from_pdf(file)
    if not pdf_text:
        return {
            "answer": "could not read PDF",
            "confidence": 0,
            "is_false": False,
            "sources": [],
            "snippet": ""
        }

    faiss_index = FaissIndex()
    faiss_index.build_index_from_text(pdf_text, title=file.filename)
    results = faiss_index.query(sentence, k=1)
    context = ""
    for r in results:
        context += r['text']

    response = fact_check_with_context(claim=sentence, context=context)
    response["sources"] = []
    return response

@app.get("/")
def root():
    return {"message": "Fact Checker API is running"}


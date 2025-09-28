from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import os 


from sentence_transformers import SentenceTransformer
import faiss
import wikipedia
import textwrap
import numpy as np
import requests

# --- Step 1: Setup
embedder = SentenceTransformer("all-MiniLM-L6-v2")
dimension = 384  # embedding size for MiniLM
index = faiss.IndexFlatIP(dimension)
documents = []  # metadata store


def wikidata_search(entity_name):
    url = "https://www.wikidata.org/w/api.php"
    params = {
        "action": "wbsearchentities",
        "search": entity_name,
        "language": "en",
        "format": "json"
    }

    headers = {
        "User-Agent": "FactChecker/1.0 (arnavdantuluri@gmail.com)"
    }

    r = requests.get(url, params=params, headers=headers)

    if r.status_code == 200:
        try:
            data = r.json()
            if "search" in data and data["search"]:
                return data["search"][0]["id"]
        except ValueError:
            print("Error decoding JSON")
    return None



def fetch_wikipedia_pages(subject, top_k=3):
    """
    Fetch top-k pages related to a subject using Wikipedia API search.
    """
    search_results = wikipedia.search(subject, results=top_k)
    pages = []
    for res in search_results:
        try:
            page = wikipedia.page(res, auto_suggest=False)
            pages.append((res, page.content))
        except Exception as e:
            print(f"Skipping {res}: {e}")
    return pages
    return pages


def chunk_text(text, chunk_size=500, overlap=50):
    """
    Split long text into overlapping chunks.
    """
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
    return chunks


def build_faiss_index(subject, top_k=3):
    """
    Pull Wikipedia docs for a subject, chunk them, and store in FAISS.
    """
    global documents, index
    documents.clear()
    index.reset()

    pages = fetch_wikipedia_pages(subject, top_k=top_k)
    all_chunks = []

    for title, text in pages:
        chunks = chunk_text(text, chunk_size=300, overlap=50)
        for c in chunks:
            documents.append({"title": title, "text": c})
            all_chunks.append(c)

    if all_chunks:
        embeddings = embedder.encode(all_chunks, convert_to_numpy=True, normalize_embeddings=True)
        index.add(embeddings)


def query_index(claim, k=3):
    """
    Search the FAISS index with a claim and return top-k chunks.
    """
    q_emb = embedder.encode([claim], convert_to_numpy=True, normalize_embeddings=True)
    D, I = index.search(q_emb, k)
    return [documents[i] for i in I[0] if i < len(documents)]

if __name__ == "__main__":
    # --- Example Usage
    from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import wikipedia
import requests

def chunk_text(text, chunk_size=500, overlap=50):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
    return chunks

class FaissIndex:
    def __init__(self):
        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        self.dimension = 384  # embedding size for MiniLM
        self.index = faiss.IndexFlatIP(self.dimension)
        self.documents = []  # metadata store

    def build_index_from_text(self, text, title=""):
        self.documents.clear()
        self.index.reset()

        chunks = chunk_text(text, chunk_size=300, overlap=50)
        all_chunks = []
        for c in chunks:
            self.documents.append({"title": title, "text": c})
            all_chunks.append(c)

        if all_chunks:
            embeddings = self.embedder.encode(all_chunks, convert_to_numpy=True, normalize_embeddings=True)
            self.index.add(embeddings)

    def build_index_from_wikipedia(self, subject, top_k=3):
        self.documents.clear()
        self.index.reset()

        search_results = wikipedia.search(subject, results=top_k)
        pages = []
        for res in search_results:
            try:
                page = wikipedia.page(res, auto_suggest=False)
                pages.append((res, page.content))
            except Exception as e:
                print(f"Skipping {res}: {e}")
        
        all_chunks = []
        for title, text in pages:
            chunks = chunk_text(text, chunk_size=300, overlap=50)
            for c in chunks:
                self.documents.append({"title": title, "text": c})
                all_chunks.append(c)

        if all_chunks:
            embeddings = self.embedder.encode(all_chunks, convert_to_numpy=True, normalize_embeddings=True)
            self.index.add(embeddings)

    def query(self, claim, k=3):
        q_emb = self.embedder.encode([claim], convert_to_numpy=True, normalize_embeddings=True)
        D, I = self.index.search(q_emb, k)
        return [self.documents[i] for i in I[0] if i < len(self.documents)]
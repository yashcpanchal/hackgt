
import requests
import openai
import json
from typing import List, Dict, Optional

# --- Wikipedia API Functions ---

def search_wiki_articles(query: str, k: int) -> List[str]:
    """
    Searches Wikipedia for a query and returns the top k article titles.
    """
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "opensearch",
        "format": "json",
        "search": query,
        "limit": str(k)
    }
    headers = {
        'User-Agent': 'GeminiFactChecker/1.0 (https://example.com; user@example.com)'
    }
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        # The result is a list [query, [titles], [summaries], [links]]
        data = response.json()
        return data[1] if len(data) > 1 else []
    except requests.RequestException as e:
        print(f"Wikipedia API Error (Search): {e}")
        return []

def get_wiki_summary(title: str) -> Optional[str]:
    """
    Gets the introductory summary of a single Wikipedia article.
    """
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "extracts",
        "exintro": True, # Get only the intro section
        "explaintext": True, # Get plain text instead of HTML
        "redirects": 1 # Follow redirects to the article
    }
    headers = {
        'User-Agent': 'GeminiFactChecker/1.0 (https://example.com; user@example.com)'
    }
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        pages = data.get("query", {}).get("pages", {})
        if pages:
            # The page ID is unknown, so we get the first one
            page_id = next(iter(pages))
            return pages[page_id].get("extract")
    except requests.RequestException as e:
        print(f"Wikipedia API Error (Summary): {e}")
    return None

# --- Main Verification Function ---

def verify_with_wikipedia(statement: str, k: int, client: openai.OpenAI) -> bool:
    """
    The main function for the backup verification plan.
    """
    print("\n--- Primary method failed. Switching to Wikipedia verification backup. ---")
    
    # 1. Search for relevant Wikipedia articles
    print(f"Searching Wikipedia for top {k} articles related to: '{statement}'...")
    article_titles = search_wiki_articles(statement, k)
    if not article_titles:
        print("Could not find any relevant Wikipedia articles.")
        return False

    # 2. Get a summary for each article
    print(f"Fetching summaries for: {article_titles}")
    summaries = []
    for title in article_titles:
        summary = get_wiki_summary(title)
        if summary:
            summaries.append(f"--- Summary of '{title}' ---\n{summary}")
    
    if not summaries:
        print("Could not fetch summaries for any articles.")
        return False
    
    context = "\n\n".join(summaries)

    # 3. Use summaries as RAG context to determine truthfulness
    print("Asking LLM to verify statement based on Wikipedia context...")
    system_prompt = (
        "You are a fact-checking assistant. Based ONLY on the provided context from Wikipedia articles, "
        "determine if the original statement is true or false. Your answer must be based strictly on the text provided. "
        "Respond ONLY with a JSON object containing a single key 'is_true' with a boolean value."
    )
    
    user_prompt = f"CONTEXT:\n{context}\n\nORIGINAL STATEMENT: \"{statement}\""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("is_true", False)
    except (openai.APIError, json.JSONDecodeError) as e:
        print(f"OpenAI API Error during final verification: {e}")
        return False

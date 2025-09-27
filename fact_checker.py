

import openai
import os
import json
import argparse
import requests
from typing import List, Dict, Tuple, Optional
from dotenv import load_dotenv

# Import the backup verification module
import wikipedia_verifier

# --- Configuration and Client Initialization ---
load_dotenv()

def get_openai_client() -> openai.OpenAI:
    """
    Initializes and returns the OpenAI client by loading the key from the environment.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not found.")
    return openai.OpenAI(api_key=api_key)

# --- OpenAI API Functions ---

def is_claim(sentence: str, client: openai.OpenAI) -> bool:
    # This function remains the same
    prompt_content = f'''
        You are a highly accurate claim detection system. Your task is to analyze a sentence and determine if it makes a factual assertion or claim that can be verified.
        Respond ONLY with a JSON object containing a single key "is_claim" with a boolean value.
        ---
        EXAMPLES:
        Sentence: "The Earth revolves around the Sun." -> {{\"is_claim\": true}}
        Sentence: "I think blue is the best color." -> {{\"is_claim\": false}}
        ---
        TASK:
        Sentence: "{sentence}" ->
    '''
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a claim detection system. Respond in JSON format."},
                {"role": "user", "content": prompt_content}
            ]
        )
        return json.loads(response.choices[0].message.content).get("is_claim", False)
    except (openai.APIError, json.JSONDecodeError) as e:
        print(f"Error checking claim: {e}")
        return False

def extract_k_text_triplets(sentence: str, k: int, client: openai.OpenAI) -> List[Dict[str, str]]:
    """
    Asks the AI to extract up to k distinct factual triplets.
    """
    system_prompt = (
        f"You are a knowledge graph expert. Your task is to extract up to {k} different, plausible triplets from the user's sentence. "
        "Each triplet must represent a distinct fact. "
        "**Crucially, the 'subject' of the triplet MUST BE a specific named entity** (like a person, place, or organization). "
        "Respond ONLY with a JSON object with a key 'triplets'. "
        "Each object must have three keys: 'subject' (string), 'object' (string), and 'relation_text' (the canonical English name of the Wikidata property, e.g., 'author', 'country of origin', 'instance of')."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Sentence: '{sentence}'\nk={k}"
                }
            ]
        )
        return json.loads(response.choices[0].message.content).get("triplets", [])
    except (openai.APIError, json.JSONDecodeError) as e:
        print(f"Error extracting triplets: {e}")
        return []

# --- Mapping and API Functions ---

def load_entity_map(file_path: str) -> Dict[str, str]:
    # This function remains the same
    lookup_map = {}
    print(f"  -> Building entity map from {file_path}...")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) >= 2:
                    item_id = parts[0]
                    for alias in parts[1:]:
                        lookup_map[alias.lower()] = item_id
        print(f"  -> Map built with {len(lookup_map)} entries.")
    except FileNotFoundError:
        print(f"Error: Lookup file not found at {file_path}")
    return lookup_map

def search_wikidata_property(relation_text: str) -> Optional[str]:
    # This function now searches for only the single best property
    url = "https://www.wikidata.org/w/api.php"
    headers = {
        'User-Agent': 'GeminiFactChecker/1.0 (https://example.com; user@example.com)'
    }
    params = {
        "action": "wbsearchentities",
        "format": "json",
        "language": "en",
        "type": "property",
        "search": relation_text,
        "limit": 1
    }
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data.get("search"):
            return data["search"][0]["id"]
    except requests.RequestException as e:
        print(f"API Error searching for property '{relation_text}': {e}")
    return None

def convert_triplet_to_ids(
    triplet: Dict[str, str],
    entity_map: Dict[str, str]
) -> Optional[Tuple[str, str, str]]:
    # This function now converts a single triplet
    subject_text = triplet.get('subject', '').lower()
    relation_text = triplet.get('relation_text', '')
    object_text = triplet.get('object', '').lower()

    subject_id = entity_map.get(subject_text)
    relation_id = search_wikidata_property(relation_text)

    if not subject_id or not relation_id:
        return None

    object_id = entity_map.get(object_text)
    final_object = object_id if object_id is not None else triplet.get('object', '')

    return (subject_id, relation_id, final_object)

# --- Main Execution Block ---

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract k distinct semantic triplets.")
    parser.add_argument("sentence", type=str, help="The input sentence.")
    parser.add_argument("k", type=int, nargs='?', default=3, help="Max number of distinct triplets to find.")

    args = parser.parse_args()

    entity_file = 'wikidata5m_entity.txt'
    print(f"Loading entity map from {entity_file}...")
    entity_map = load_entity_map(entity_file)

    if not entity_map:
        print("Could not load entity lookup file. Exiting.")
        exit()

    try:
        openai_client = get_openai_client()

        if not is_claim(args.sentence, openai_client):
            print(False)
            exit()

        # Ask the AI for k distinct triplets
        text_triplets = extract_k_text_triplets(args.sentence, args.k, openai_client)

        if not text_triplets:
            # If no triplets are extracted, go to backup plan
            #final_result = wikipedia_verifier.verify_with_wikipedia(args.sentence, args.k, openai_client)
            #print(final_result)
            print("Need backup plan")
            exit()

        # Convert each extracted triplet to its ID form
        id_triplets = []
        for triplet in text_triplets:
            id_tuple = convert_triplet_to_ids(triplet, entity_map)
            if id_tuple:
                id_triplets.append(id_tuple)

        if not id_triplets:
            # If conversion fails for all triplets, go to backup plan
            final_result = wikipedia_verifier.verify_with_wikipedia(args.sentence, args.k, openai_client)
            print(final_result)
        else:
            print(id_triplets)

    except ValueError as e:
        print(f"Initialization Error: {e}")



import openai
import os
import json
import argparse
import requests
from typing import List, Dict, Tuple, Optional
from dotenv import load_dotenv

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
        You are a highly accurate claim detection system. Your task is to analyze a sentence and determine if it makes a factual assertion or claim that can be verified. Remember that a factual assertion is something that can be proven true or false that doesn't display any sort of bias or opinion or doesn't give something an unproven level of importance.
        Respond ONLY with a JSON object containing a single key "is_claim" with a boolean value.
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
    sentence: str,
    triplet: Dict[str, str],
    entity_map: Dict[str, str]
) -> Optional[Tuple[str, str, str]]:
    # This function now converts a single triplet
    subject_text = triplet.get('subject', '').lower()
    relation_text = triplet.get('relation_text', '')
    object_text = triplet.get('object', '').lower()

    subject_id = entity_map.get(subject_text)
    relation_id = search_wikidata_property(relation_text)
    object_id = entity_map.get(object_text)
    final_object = object_id if object_id is not None else triplet.get('object', '')

    if not subject_id:
        return (subject_text, sentence)
    
    if subject_id and (not relation_id or not object_id):
        return (subject_text, sentence)

    return (subject_id, relation_id, final_object)

# --- Main Execution Block ---

def compute_triplets(sentence, k):

    entity_file = 'data/wikidata5m_entity.txt'
    print(f"Loading entity map from {entity_file}...")
    entity_map = load_entity_map(entity_file)

    if not entity_map:
        print("Could not load entity lookup file. Exiting.")
        exit()

    try:
        openai_client = get_openai_client()
        if not is_claim(sentence, openai_client):
            print(False)
            exit()

        # Ask the AI for k distinct triplets
        text_triplets = extract_k_text_triplets(sentence, k, openai_client)

        if not text_triplets:
            # If no triplets are extracted, go to backup plan
            #final_result = wikipedia_verifier.verify_with_wikipedia(args.sentence, args.k, openai_client)
            #print(final_result)
            print("Need backup plan")
            exit()

        # Convert each extracted triplet to its ID form
        id_triplets = []
        subject = None
        for triplet in text_triplets:
            id_tuple = convert_triplet_to_ids(sentence, triplet, entity_map)
            if len(id_tuple) == 3:
                id_triplets.append(id_tuple)
            else:
                sentence, _ = id_tuple

        if not id_triplets:
            # If conversion fails for all triplets, go to backup plan
            #final_result = wikipedia_verifier.verify_with_wikipedia(args.sentence, args.k, openai_client)
            return sentence, subject
        else:
            return (id_triplets, None)

    except ValueError as e:
        print(f"Initialization Error: {e}")
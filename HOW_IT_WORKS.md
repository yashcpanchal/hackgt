
# How the Triplet Extraction Script Works

## Overview

This Python script is a command-line tool that takes a sentence and an integer `k` as input. It analyzes the sentence to extract up to `k` semantic triplets (subject-relation-object). It then converts these triplets into a structured format using Wikidata IDs for the subject and relation, and either a Wikidata ID or a literal value for the object. The final output is a list of these ID-based tuples.

## Dependencies

The script requires the following Python libraries:

- `openai`: For making calls to the OpenAI API (GPT-4o-mini).
- `requests`: For making live API calls to the Wikidata API.
- `python-dotenv`: To load the OpenAI API key from a `.env` file.

## Configuration

To use the script, you must have an OpenAI API key. This key should be stored in a file named `.env` in the same directory as the script, in the following format:

```
OPENAI_API_KEY='your_key_here'
```

## Usage

Run the script from your terminal:

```bash
python3 main.py "Your sentence goes here" <k>
```

- `sentence`: The sentence you want to analyze (must be in quotes).
- `k`: (Optional) The maximum number of triplets to extract. Defaults to 3.

--- 

## Workflow Details

The script follows a multi-stage hybrid workflow:

### 1. Argument Parsing & Setup

- The script starts by parsing the command-line arguments (`sentence` and `k`).
- It then loads the `OPENAI_API_KEY` from the `.env` file.

### 2. Local Entity Loading

- The script reads the `wikidata5m_entity.txt` file into an in-memory dictionary (a "map"). 
- This map stores every known entity alias (in lowercase) as a key, with its corresponding Wikidata Q-ID as the value. This allows for very fast, local lookups of subjects and objects.

### 3. Claim Detection

- The `is_claim` function sends the input sentence to the OpenAI API.
- It uses a carefully crafted prompt with examples to ask the AI whether the sentence is a verifiable factual assertion.
- If the AI returns `false`, the script prints `False` to the console and terminates.

### 4. AI-Powered Triplet Extraction

- If the sentence is a claim, the `extract_triplets_with_relation_text` function is called.
- This function sends the sentence to the OpenAI API with another detailed prompt containing few-shot examples.
- It specifically instructs the AI to return a JSON object containing a list of triplets. For each triplet, the `relation` should be the canonical English name of the property (e.g., "country of origin").

### 5. Hybrid ID Conversion

- For each text triplet extracted by the AI, the `convert_triplet_to_ids` function attempts to convert it:
    - **Subject & Object Mapping (Local):** It looks up the lowercase subject and object text in the entity map that was loaded from `wikidata5m_entity.txt` in Step 2. If an object is not found in the map, it is treated as a literal value (e.g., a date, a number, or a simple string).
    - **Relation Mapping (Live API):** It takes the `relation_text` (e.g., "boiling point") and calls the `search_wikidata_property` function. This function performs a **live API call** to `https://www.wikidata.org/w/api.php` to search for a Wikidata Property with that name and retrieve its P-ID.
- A triplet is only considered successful if both the subject and relation can be mapped to an ID.

### 6. Final Output

- The script collects all the successfully converted ID-based tuples.
- If one or more triplets were successfully converted, it prints the final list of tuples, e.g., `[('Q90', 'P1128', '100 degrees Celsius')]`.
- If the initial extraction returns no triplets, or if none of the extracted triplets can be successfully converted to IDs, the script prints the string `"Need alternative checking method"`.


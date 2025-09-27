# Instructions for Python Script Generation

You are an expert Python developer specializing in natural language processing with the OpenAI API. Your task is to write a single, self-contained Python script that implements a text-to-triplet extraction pipeline.

---

## Core Workflow

The script must follow these steps precisely:
1.  Accept a block of text and an integer `k` as input.
2.  Split the text into individual sentences.
3.  For each sentence, perform a two-step analysis using the OpenAI API:
    a. **Claim Detection:** Make an API call to determine if the sentence is a factual claim.
    b. **Triplet Extraction:** If it is a claim, make a second API call to extract up to `k` subject-predicate-object triplets.
4.  Collect the results into a single dictionary where keys are the claim-sentences and values are their extracted triplets.
5.  Print the final dictionary as a formatted JSON string.

---

## Technical Requirements

- **Language:** Python 3.
- **Libraries:** Use the `openai`, `os`, `re`, and `json` libraries.
- **API Key:** The script **MUST** load the OpenAI API key from an environment variable named `OPENAI_API_KEY`. Do not hardcode the key in the script.
- **Error Handling:** Include `try...except` blocks to gracefully handle potential API errors (e.g., rate limits, invalid requests) and errors from parsing the JSON responses.
- **Model:** Use a modern and efficient model like `gpt-4o-mini`.

---

## Function Implementation & Prompts

The script should be structured with functions that use the OpenAI Chat Completions endpoint. The API calls must be configured to use JSON Mode for reliable output.

### 1. For Claim Detection
- **Function:** `is_claim(sentence: str, client: openai.OpenAI) -> bool`
- **API Call Prompt:**

    {
      "model": "gpt-4o-mini",
      "response_format": { "type": "json_object" },
      "messages": [
        {
          "role": "system",
          "content": "You are a claim detection system. Analyze the user's sentence and determine if it makes a factual assertion. Respond ONLY with a JSON object with a single key 'is_claim' and a boolean value."
        },
        {
          "role": "user",
          "content": "The Earth revolves around the Sun."
        }
      ]
    }

### 2. For Triplet Extraction
- **Function:** `extract_triplets(sentence: str, k: int, client: openai.OpenAI) -> list`
- **API Call Prompt:**

    {
      "model": "gpt-4o-mini",
      "response_format": { "type": "json_object" },
      "messages": [
        {
          "role": "system",
          "content": "You are a knowledge graph expert. Extract k possible triplets from the user's sentence. A triplet has a 'subject', 'relation', and 'object'. Respond ONLY with a JSON object with a single key 'triplets' which contains a list of the triplet objects."
        },
        {
          "role": "user",
          "content": "Sentence: 'The Eiffel Tower, designed by Gustave Eiffel, is located in Paris.'\nk=2"
        }
      ]
    }

---

## Code Structure

- Create a main orchestrator function: `process_text_to_triplets(text: str, k: int) -> dict`.
- The script must be runnable from the command line. Include a `if __name__ == "__main__":` block.
- Add comments explaining the purpose of each function and the structure of the API calls.

### Demonstration
In the `if __name__ == "__main__":` block, use the following sample text to run the process and print the final JSON output.

**Sample Text:**

    """
    The Golden Gate Bridge is a suspension bridge spanning the Golden Gate. It was designed by engineer Joseph Strauss in 1917. I wonder how long it took to build? Its construction was completed in 1937. Many people think it's the most beautiful bridge.
    """

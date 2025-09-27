# Instructions for Python Script Generation

You are an expert Python developer specializing in natural language processing with local models. Your task is to write a single, self-contained Python script that uses Hugging Face `transformers` models to implement a text-to-triplet extraction pipeline.

---

## Core Workflow

The script must follow these steps precisely:
1.  Take a block of text as input.
2.  Split the text into individual sentences.
3.  For each sentence, perform a two-step analysis using local Hugging Face models:
    a. **Claim Detection:** First, determine if the sentence makes a factual claim.
    b. **Triplet Extraction:** If the sentence is identified as a claim, extract all possible subject-predicate-object triplets from it.
4.  Collect the results into a single dictionary where the keys are the sentences identified as claims and the values are the lists of their extracted triplets.
5.  Print the final dictionary to the console as a well-formatted JSON string.

---

## Technical and Model Requirements

### Libraries
- The script must use `transformers`, `torch`, `re`, and `json`.
- It must not require any external API keys (e.g., OpenAI, Anthropic, or Gemini).

### Hardware
- The script should be able to leverage a GPU for model inference if one is available (`torch.cuda.is_available()`), but should also work on a CPU.

### Model 1: Claim Detection
- **Model Name:** `facebook/bart-large-mnli`
- **Implementation:** Use the `pipeline("zero-shot-classification", ...)` from the `transformers` library.
- **Logic:**
    - Classify each sentence against these specific candidate labels: `["factual assertion", "opinion", "question"]`.
    - A sentence is considered a factual claim if and only if the top-scoring label is `factual assertion` with a confidence score greater than **0.6**.

### Model 2: Triplet Extraction
- **Model Name:** `knowledgator/oie-model-base-v2`
- **Implementation:** Load this model using `AutoTokenizer` and `AutoModelForSeq2SeqLM`.
- **Output Parsing:** You must implement logic to parse the model's unique string output. The format is as follows:
    - Triplets are separated by the special token `<ts>`.
    - Within each triplet, the subject, relation, and object are separated by the special token `<sep>`.
    - Your code must correctly split these strings to reconstruct the structured triplet data.

---

## Code Structure

- Encapsulate the main logic in a function: `process_text_to_triplets(text: str) -> dict`.
- The script must be runnable from the command line. Include a main execution block (`if __name__ == "__main__":`) to demonstrate its functionality.
- The code must be thoroughly commented to explain the purpose of each model and the key logic steps, especially the output parsing for the triplet extraction model.

### Demonstration
In the `if __name__ == "__main__":` block, use the following sample text to run the process and print the final JSON output.

**Sample Text:**
```python
"""
The Golden Gate Bridge is a suspension bridge spanning the Golden Gate, the one-mile-wide strait connecting San Francisco Bay and the Pacific Ocean. It was designed by engineer Joseph Strauss in 1917. I wonder how long it took to build? Its construction was completed in 1937. Many people think it's the most beautiful bridge.
"""

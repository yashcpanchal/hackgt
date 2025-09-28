# import math
# import time
# import collections
# import os
# import redis # we want to use redis to make the wikihash persist in memory so we don't reload it every time
# import random

# # Triplets is a list of top 5 predicates attached to a subject to increase knowledge graph hits
# def build_wikihash() -> set:
#     path = os.getcwd()
#     redis_server = set()
#     # with open(f"{path}/backend/data/wikidata5m_transductive_train.txt", "r", encoding="utf-8") as f:
#     #     for line in f:
#     #         h, r, t = line.strip().split()
#     #         redis_server.add((h, r, t))
#     with open(f"{path}/backend/data/wikidata5m_transductive_test.txt", "r", encoding="utf-8") as f:
#         for line in f:
#             h, r, t = line.strip().split()
#             redis_server.add((h, r, t))
#     # with open(f"{path}/backend/data/wikidata5m_transductive_valid.txt", "r", encoding="utf-8") as f:
#     #     for line in f:
#     #         h, r, t = line.strip().split()
#     #         redis_server.add((h, r, t))
    
#     return redis_server

# # Return 
# def check_triplets(triplets: list) -> bool:
#     redis_server = build_wikihash()
#     print("Sample triples:", list(redis_server)[0])
#     # for query in triplets:
#     #     if redis_server.sismember("triples", query):
#     #         return True

#     return False


# if __name__ == "__main__":
#     test_triplets = [(), (), ()]
#     wiki_hash = build_wikihash()
#     check_triplets(test_triplets)

from sentence_pre import is_claim, get_openai_client

import requests

if __name__ == "__main__":
    sentence = "The Atlanta Falcons are a team in the NFL"
    k = 3

    url = "http://localhost:8000/check_fact"
    print("post request one")
    response = requests.post(url, params={"sentence": sentence})

    print(response.json())

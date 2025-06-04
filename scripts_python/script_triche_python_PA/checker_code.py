from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def calculate_similarity(code1, code2):
    documents = [code1, code2]
    vectorizer = TfidfVectorizer()
    tfidf = vectorizer.fit_transform(documents)
    return float(cosine_similarity(tfidf)[0][1])
import os
import nltk

# Forcer un dossier local pour stocker les ressources nltk
NLTK_DIR = os.path.join(os.path.dirname(__file__), 'nltk_data')
nltk.data.path.append(NLTK_DIR)

# Télécharger les ressources dans ce dossier local
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('punkt_tab')
nltk.download('wordnet')
nltk.download('omw-1.4')

# Imports normaux ensuite
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def preprocess(text):
    stop_words = set(stopwords.words('english'))
    stemmer = PorterStemmer()

    tokens = word_tokenize(text.lower())
    tokens = [stemmer.stem(token) for token in tokens if token.isalpha() and token not in stop_words]

    return ' '.join(tokens)

def calculate_similarity(text1, text2):
    texts = [preprocess(text1), preprocess(text2)]
    vectorizer = TfidfVectorizer()
    tfidf = vectorizer.fit_transform(texts)
    return float(cosine_similarity(tfidf)[0][1])
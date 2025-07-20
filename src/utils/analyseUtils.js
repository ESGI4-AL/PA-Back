const isSystemFile = (fileName) => {
  const systemFiles = ['.DS_Store', 'Thumbs.db', '.gitignore', 'package-lock.json'];
  const systemExtensions = ['.log', '.tmp', '.cache'];

  return systemFiles.includes(path.basename(fileName)) ||
         systemExtensions.some(ext => fileName.endsWith(ext)) ||
         fileName.includes('node_modules/') ||
         fileName.includes('.git/');
};

const detectFileTypeFromContent = (content, fileName) => {
  const ext = path.extname(fileName).toLowerCase();

  // Extensions code
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb'];
  if (codeExtensions.includes(ext)) return 'code';

  // Extensions texte
  const textExtensions = ['.txt', '.md', '.json', '.html', '.css', '.xml', '.csv'];
  if (textExtensions.includes(ext)) return 'text';

  // Détecter par contenu
  if (content.length > 0) {
    const firstLine = content.split('\n')[0].toLowerCase();
    if (firstLine.includes('<!DOCTYPE') || firstLine.includes('<html')) return 'text';
    if (firstLine.includes('package') || firstLine.includes('import') || firstLine.includes('function')) return 'code';
  }

  return 'binary';
};

const calculateLevenshteinSimilarity = (str1, str2) => {
  // Optimisation pour les gros fichiers
  if (str1.length > 5000) str1 = str1.substring(0, 5000);
  if (str2.length > 5000) str2 = str2.substring(0, 5000);

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength > 0 ? 1 - (distance / maxLength) : 1;
};

const calculateNgramSimilarity = (text1, text2, n = 3) => {
  // Normaliser les textes
  text1 = text1.toLowerCase().replace(/\s+/g, ' ').trim();
  text2 = text2.toLowerCase().replace(/\s+/g, ' ').trim();

  // Optimisation
  if (text1.length > 10000) text1 = text1.substring(0, 10000);
  if (text2.length > 10000) text2 = text2.substring(0, 10000);

  const getNgrams = (text, n) => {
    const ngrams = new Set();
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.add(text.substring(i, i + n));
    }
    return ngrams;
  };

  const ngrams1 = getNgrams(text1, n);
  const ngrams2 = getNgrams(text2, n);

  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);

  return union.size > 0 ? intersection.size / union.size : 0;
};

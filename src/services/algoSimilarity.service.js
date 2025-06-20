const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { bucket } = require('../utils/firebase');
const { Deliverable, Submission } = require('../models');
const { AppError } = require('../middlewares/error.middleware');

//config= commentaire a garder lors du clean code, important, en francais expres pour me retrouver
const MAX_FILE_SIZE = 10 * 1024 * 1024; //10MB
const SIMILARITY_THRESHOLD = 0.8;//seuil de suspicion


//Télécharge un fichier depuis Firebase Storage
 
const downloadFile = async (filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Chemin de fichier invalide');
    }

    if (!filePath.includes('firebase') && !filePath.includes('googleapis.com')) {
      throw new Error('URL Firebase non reconnue');
    }

    const encodedPath = filePath.split('/o/')[1]?.split('?')[0];
    if (!encodedPath) {
      throw new Error('Format URL Firebase incorrect');
    }

    const decodedPath = decodeURIComponent(encodedPath);
    const file = bucket.file(decodedPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Fichier non trouvé dans Firebase Storage');
    }

    const [buffer] = await file.download();
    
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Fichier trop volumineux: ${buffer.length} bytes (max: ${MAX_FILE_SIZE})`);
    }

    return buffer;
  } catch (error) {
    throw new Error(`Erreur téléchargement: ${error.message}`);
  }
};

//ici on detecte le type de fichier 
const detectFileType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  
  if (['.txt', '.md', '.json', '.js', '.py', '.java', '.c', '.cpp', '.html', '.css', '.ts', '.jsx', '.tsx'].includes(ext)) {
    return 'text';
  }
  if (['.zip', '.rar', '.tar', '.gz', '.7z'].includes(ext)) {
    return 'archive';
  }
  if (['.pdf', '.doc', '.docx'].includes(ext)) {
    return 'document';
  }
  return 'binary';
};

//ALGO ICI 


//similarite par Hash MD5 (détection  pour copie exacte)

const hashSimilarity = async (file1Path, file2Path) => {
  try {
    const [buffer1, buffer2] = await Promise.all([
      downloadFile(file1Path),
      downloadFile(file2Path)
    ]);

    const hash1 = crypto.createHash('md5').update(buffer1).digest('hex');
    const hash2 = crypto.createHash('md5').update(buffer2).digest('hex');

    return {
      score: hash1 === hash2 ? 1.0 : 0.0,
      method: 'hash',
      details: {
        hash1: hash1.substring(0, 8) + '...',
        hash2: hash2.substring(0, 8) + '...',
        identical: hash1 === hash2,
        size1: buffer1.length,
        size2: buffer2.length
      }
    };
  } catch (error) {
    return { score: 0, method: 'hash', error: error.message };
  }
};


//distance de Levenshtein pour textes
const levenshteinDistance = (str1, str2) => {
  //opti pour les plus gros texte
  if (str1.length > 5000 || str2.length > 5000) {
    str1 = str1.substring(0, 5000);
    str2 = str2.substring(0, 5000);
  }

  const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,//on supp
          matrix[j][i - 1] + 1,//on inssert
          matrix[j - 1][i - 1] + 1 //on remplace
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};


//Similarité textuelle (Levenshtein + normalisation)
const textSimilarity = async (file1Path, file2Path) => {
  try {
    const [buffer1, buffer2] = await Promise.all([
      downloadFile(file1Path),
      downloadFile(file2Path)
    ]);

    const text1 = buffer1.toString('utf-8').toLowerCase().trim();
    const text2 = buffer2.toString('utf-8').toLowerCase().trim();

    if (text1.length === 0 && text2.length === 0) return { score: 1.0, method: 'text' };
    if (text1.length === 0 || text2.length === 0) return { score: 0.0, method: 'text' };

    const distance = levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    const similarity = 1 - (distance / maxLength);

    return {
      score: Math.max(0, similarity),
      method: 'text',
      details: {
        distance,
        length1: text1.length,
        length2: text2.length,
        maxLength
      }
    };
  } catch (error) {
    return { score: 0, method: 'text', error: error.message };
  }
};


//similarite par N-grammes (pour code source)
const ngramSimilarity = async (file1Path, file2Path, n = 3) => {
  try {
    const [buffer1, buffer2] = await Promise.all([
      downloadFile(file1Path),
      downloadFile(file2Path)
    ]);

    let text1 = buffer1.toString('utf-8').toLowerCase().replace(/\s+/g, ' ').trim();
    let text2 = buffer2.toString('utf-8').toLowerCase().replace(/\s+/g, ' ').trim();

    //opti pour les plus gros texte
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

    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    return {
      score: jaccardSimilarity,
      method: 'ngram',
      details: {
        n,
        ngrams1Size: ngrams1.size,
        ngrams2Size: ngrams2.size,
        intersection: intersection.size,
        union: union.size
      }
    };
  } catch (error) {
    return { score: 0, method: 'ngram', error: error.message };
  }
};


//similarite structurelle pour archives ZIP
const structureSimilarity = async (file1Path, file2Path) => {
  try {
    const [buffer1, buffer2] = await Promise.all([
      downloadFile(file1Path),
      downloadFile(file2Path)
    ]);

    const getFileStructure = (buffer) => {
      const size = buffer.length;
      const hash = crypto.createHash('md5').update(buffer.slice(0, 1024)).digest('hex');
      
      //analyse des bytes
      const chunks = [];
      for (let i = 0; i < Math.min(buffer.length, 1024); i += 256) {
        const chunk = buffer.slice(i, i + 256);
        chunks.push(crypto.createHash('md5').update(chunk).digest('hex').substring(0, 8));
      }
      
      return { size, headerHash: hash, patterns: chunks };
    };

    const struct1 = getFileStructure(buffer1);
    const struct2 = getFileStructure(buffer2);

    //basé sur la taille relatif, similartié
    const sizeDiff = Math.abs(struct1.size - struct2.size);
    const avgSize = (struct1.size + struct2.size) / 2;
    const sizeScore = avgSize > 0 ? Math.max(0, 1 - (sizeDiff / avgSize)) : 1;

    //same des en-têtes
    const headerScore = struct1.headerHash === struct2.headerHash ? 1.0 : 0.0;

    //same des patterns
    const commonPatterns = struct1.patterns.filter(p => struct2.patterns.includes(p)).length;
    const totalPatterns = Math.max(struct1.patterns.length, struct2.patterns.length);
    const patternScore = totalPatterns > 0 ? commonPatterns / totalPatterns : 0;

    const finalScore = (sizeScore * 0.5) + (headerScore * 0.2) + (patternScore * 0.3);

    return {
      score: finalScore,
      method: 'structure',
      details: {
        size1: struct1.size,
        size2: struct2.size,
        sizeSimilarity: sizeScore,
        headerSimilarity: headerScore,
        patternSimilarity: patternScore
      }
    };
  } catch (error) {
    return { score: 0, method: 'structure', error: error.message };
  }
};


//analyse la similarite entre deux fichiers
//choisit automatiquement le meilleur algo selon le type

const analyzeFileSimilarity = async (file1Path, file2Path) => {
  const fileName1 = path.basename(file1Path);
  const fileName2 = path.basename(file2Path);
  
  const type1 = detectFileType(fileName1);
  const type2 = detectFileType(fileName2);

  const results = {
    file1: fileName1,
    file2: fileName2,
    type1,
    type2,
    algorithms: [],
    finalScore: 0,
    recommendedMethod: '',
    timestamp: new Date().toISOString()
  };

  try {
    //toujours faire le test de hash (copies exactes)
    const hashResult = await hashSimilarity(file1Path, file2Path);
    results.algorithms.push(hashResult);

    //si fichiers identiques, pas besoin d'autres tests
    if (hashResult.score === 1.0) {
      results.finalScore = 1.0;
      results.recommendedMethod = 'hash';
      return results;
    }

    //tests selon le type de fichier
    if (type1 === 'text' && type2 === 'text') {
      //pour les fichiers texte : Levenshtein + N-grammes
      const [textResult, ngramResult] = await Promise.all([
        textSimilarity(file1Path, file2Path),
        ngramSimilarity(file1Path, file2Path, 4)
      ]);
      
      results.algorithms.push(textResult, ngramResult);
      
      //score moyen, pondere 40% texte, 60% n grammes, c'est le mieu je pense
      results.finalScore = (textResult.score * 0.4) + (ngramResult.score * 0.6);
      results.recommendedMethod = 'hybrid_text';
      
    } else if (type1 === 'archive' && type2 === 'archive') {
      //pour les archives : structure + n-grammes
      const [structResult, ngramResult] = await Promise.all([
        structureSimilarity(file1Path, file2Path),
        ngramSimilarity(file1Path, file2Path, 5)
      ]);
      
      results.algorithms.push(structResult, ngramResult);
      results.finalScore = (structResult.score * 0.6) + (ngramResult.score * 0.4);
      results.recommendedMethod = 'hybrid_archive';
      
    } else {
      //si types différents ou non supportés : uniquement ngramme
      const ngramResult = await ngramSimilarity(file1Path, file2Path, 3);
      results.algorithms.push(ngramResult);
      results.finalScore = ngramResult.score;
      results.recommendedMethod = 'ngram';
    }

    //score en 0 - 1 
    results.finalScore = Math.max(0, Math.min(1, results.finalScore));

  } catch (error) {
    console.error('Erreur dans analyzeFileSimilarity:', error);
    results.error = error.message;
    results.finalScore = 0;
  }

  return results;
};


module.exports = {
  analyzeFileSimilarity,
  analyzeSimilarity,
  hashSimilarity,
  textSimilarity,
  ngramSimilarity,
  structureSimilarity,
  MAX_FILE_SIZE,
  SIMILARITY_THRESHOLD
};
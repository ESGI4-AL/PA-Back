const deliverableService = require('../services/deliverable.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const { Submission, Group, User, Deliverable, Project } = require('../models');
const AdmZip = require('adm-zip');
const path = require('path');
const { downloadFile, levenshteinDistance } = require('../services/algoSimilarity.service');

const createDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deliverableData = req.body;
  const teacherId = req.user.id;

  const deliverable = await deliverableService.createDeliverable(id, deliverableData, teacherId);

  res.status(201).json({
    status: 'success',
    message: 'Deliverable created successfully',
    data: deliverable
  });
});

const getDeliverableById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deliverable = await deliverableService.getDeliverableById(id);

  res.status(200).json({
    status: 'success',
    data: deliverable
  });
});

const getProjectDeliverables = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const deliverables = await deliverableService.getProjectDeliverables(id, userId);

  res.status(200).json({
    status: 'success',
    data: deliverables
  });
});

const updateDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const teacherId = req.user.id;

  if (req.file && req.file.firebaseUrl) {
    updateData.archiveUrl = req.file.firebaseUrl;
  }

  const deliverable = await deliverableService.updateDeliverable(id, updateData, teacherId);

  res.status(200).json({
    status: 'success',
    message: 'Deliverable updated successfully',
    data: deliverable
  });
});

const deleteDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;

  const result = await deliverableService.deleteDeliverable(id, teacherId);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const submitDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const submissionData = req.body;
  const { groupId } = req.body;

  if (req.file) {
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (req.file.size > maxFileSize) {
      return res.status(400).json({
        status: 'error',
        message: `Fichier trop volumineux. Taille maximum: ${maxFileSize / 1024 / 1024}MB, taille reçue: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
        code: 'FILE_TOO_LARGE'
      });
    }
  }

  const fileName = req.body.fileName;
  const fileSize = req.body.fileSize ? parseInt(req.body.fileSize) : null;

  if (req.gitSubmission) {
    const deliverable = await deliverableService.getDeliverableById(id);
    if (!deliverable) {
      return res.status(404).json({
        status: 'error',
        message: 'Livrable non trouvé.'
      });
    }

    if (deliverable.type === 'git') {
      const gitUrl = req.gitSubmission.gitUrl;
      const gitUrlRegex = /^https:\/\/(github|gitlab|bitbucket)\.com\/[^/]+\/[^/]+/;

      if (!gitUrlRegex.test(gitUrl)) {
        return res.status(400).json({
          status: 'error',
          message: 'Lien Git invalide pour ce type de livrable.'
        });
      }

      const submission = await deliverableService.submitDeliverable(
        id,
        { gitUrl: gitUrl },
        groupId,
        null,
        `Git: ${gitUrl}`,
        null
      );

      return res.status(200).json({
        status: 'success',
        message: 'Livrable Git soumis avec succès',
        data: {
          submission,
          validation: {
            valid: true,
            details: [
              { rule: 'git_url', valid: true, message: 'URL Git validée' }
            ]
          }
        }
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Ce livrable n\'accepte que les fichiers, pas les liens Git.'
      });
    }
  }

  let fileUrl = null;

  if (req.firebaseUpload) {
    fileUrl = req.firebaseUpload.downloadUrl;
  }

  const deliverable = await deliverableService.getDeliverableById(id);

  if (!deliverable) {
    return res.status(404).json({
      status: 'error',
      message: 'Livrable non trouvé.'
    });
  }

  if (deliverable.type === 'archive') {
    if (!fileUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Un fichier est requis pour ce livrable de type archive.'
      });
    }

    const originalName = req.firebaseUpload.originalName.toLowerCase();
    const allowedExtensions = ['.zip', '.tar.gz', '.tgz'];
    const isValidExtension = allowedExtensions.some(ext => originalName.endsWith(ext));

    if (!isValidExtension) {
      return res.status(400).json({
        status: 'error',
        message: 'Le fichier doit être une archive au format .zip, .tar.gz ou .tgz.'
      });
    }
  } else if (deliverable.type === 'git') {
    return res.status(400).json({
      status: 'error',
      message: 'Ce livrable nécessite un lien Git, pas un fichier.'
    });
  }

  try {
    const submission = await deliverableService.submitDeliverable(
      id,
      submissionData,
      groupId,
      fileUrl,
      fileName || req.firebaseUpload?.fileName,
      fileSize || req.firebaseUpload?.size
    );

    res.status(200).json({
      status: 'success',
      message: 'Livrable soumis avec succès',
      data: {
        submission,
        validation: {
          valid: true,
          details: [
            { rule: 'upload', valid: true, message: 'Archive uploadée sur Firebase' },
            { rule: 'format', valid: true, message: 'Format de fichier accepté' }
          ]
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la soumission du livrable',
      error: error.message
    });
  }
});

const analyzeSimilarity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await deliverableService.analyzeSimilarity(id);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

const analyzeArchivesSimilarity = async (req, res, next) => {
  try {
    const { archive1Path, archive2Path } = req.body;

    console.log('=== DEBUT ANALYSE DETAILLEE ARCHIVES ===');
    console.log('Archive 1:', archive1Path);
    console.log('Archive 2:', archive2Path);

    // Vérifier que les chemins sont fournis
    if (!archive1Path || !archive2Path) {
      return res.status(400).json({
        status: 'error',
        message: 'Les chemins des deux archives sont requis'
      });
    }

    // Télécharger et analyser les archives
    const result = await compareArchivesInDetail(archive1Path, archive2Path);

    res.json({
      status: 'success',
      data: result
    });

  } catch (error) {
    console.error('Erreur analyse détaillée:', error);
    next(error);
  }
};

const getArchiveFileContent = async (req, res, next) => {
  try {
    const { archivePath, fileName } = req.body;

    console.log('Extraction fichier:', { archivePath, fileName });

    if (!archivePath || !fileName) {
      return res.status(400).json({
        status: 'error',
        message: 'Chemin d\'archive et nom de fichier requis'
      });
    }

    // Télécharger l'archive depuis Firebase
    const { buffer } = await downloadFile(archivePath);

    // Créer l'objet ZIP
    const zip = new AdmZip(buffer);

    // Lister tous les fichiers pour déboguer
    const entries = zip.getEntries();
    console.log('Fichiers dans l\'archive:', entries.map(e => e.entryName));

    // Trouver le fichier (gestion des différents formats de chemin)
    let targetEntry = zip.getEntry(fileName);

    // Si pas trouvé, essayer sans le chemin complet
    if (!targetEntry) {
      const baseFileName = fileName.split('/').pop() || fileName;
      targetEntry = entries.find(entry =>
        entry.entryName.endsWith(baseFileName) && !entry.isDirectory
      );
    }

    // Si toujours pas trouvé, essayer une recherche plus flexible
    if (!targetEntry) {
      targetEntry = entries.find(entry =>
        entry.entryName.toLowerCase().includes(fileName.toLowerCase()) && !entry.isDirectory
      );
    }

    if (!targetEntry) {
      console.error('Fichier non trouvé:', fileName);
      console.error('Fichiers disponibles:', entries.map(e => e.entryName));

      return res.status(404).json({
        status: 'error',
        message: 'Fichier non trouvé dans l\'archive',
        availableFiles: entries.map(e => e.entryName).slice(0, 10) // Limiter pour éviter trop de données
      });
    }

    // Extraire le contenu
    const content = targetEntry.getData().toString('utf8');

    console.log(`Fichier ${targetEntry.entryName} extrait avec succès (${content.length} caractères)`);

    res.json({
      status: 'success',
      data: {
        content,
        fileName: targetEntry.entryName,
        originalFileName: fileName,
        size: content.length,
        encoding: 'utf8'
      }
    });

  } catch (error) {
    console.error('Erreur extraction fichier archive:', error);

    // Donner plus de détails sur l'erreur
    let errorMessage = 'Erreur lors de l\'extraction du fichier';
    if (error.message.includes('Invalid or unsupported zip format')) {
      errorMessage = 'Format d\'archive non supporté ou corrompu';
    } else if (error.message.includes('Erreur téléchargement')) {
      errorMessage = 'Impossible de télécharger l\'archive depuis Firebase';
    }

    res.status(500).json({
      status: 'error',
      message: errorMessage,
      details: error.message
    });
  }
};

const compareArchivesInDetail = async (archive1Path, archive2Path) => {
  try {
    // Télécharger les deux archives
    const [buffer1, buffer2] = await Promise.all([
      (await downloadFile(archive1Path)).buffer,
      (await downloadFile(archive2Path)).buffer
    ]);

    console.log('Archives téléchargées, décompression...');

    // Créer les objets ZIP
    const zip1 = new AdmZip(buffer1);
    const zip2 = new AdmZip(buffer2);

    // Extraire les listes de fichiers
    const entries1 = zip1.getEntries().filter(entry => !entry.isDirectory);
    const entries2 = zip2.getEntries().filter(entry => !entry.isDirectory);

    console.log(`Archive 1: ${entries1.length} fichiers`);
    console.log(`Archive 2: ${entries2.length} fichiers`);

    // 1. ANALYSE STRUCTURELLE RAPIDE
    const structuralSimilarity = analyzeStructuralSimilarity(entries1, entries2);
    console.log(`Similarité structurelle: ${(structuralSimilarity * 100).toFixed(1)}%`);

    // 2. COMPARAISONS DE FICHIERS
    const fileComparisons = [];
    let totalComparisons = 0;
    let significantComparisons = 0;

    // Comparer chaque fichier de l'archive 1 avec tous les fichiers de l'archive 2
    for (const entry1 of entries1) {
      const fileName1 = entry1.entryName;
      const content1 = entry1.getData().toString('utf8');

      // Filtrer les fichiers trop petits ou non pertinents
      if (content1.length < 50 || isSystemFile(fileName1)) {
        continue;
      }

      const fileResult = {
        sourceFile: fileName1,
        targetComparisons: [],
        bestMatch: null,
        bestScore: 0
      };

      for (const entry2 of entries2) {
        const fileName2 = entry2.entryName;
        const content2 = entry2.getData().toString('utf8');

        // Filtrer les fichiers trop petits ou non pertinents
        if (content2.length < 50 || isSystemFile(fileName2)) {
          continue;
        }

        totalComparisons++;

        // Comparer les contenus
        const similarity = await compareFileContents(content1, content2, fileName1, fileName2);

        fileResult.targetComparisons.push({
          fileName: fileName2,
          similarity: similarity.score,
          method: similarity.method,
          details: similarity.details
        });

        // Mettre à jour le meilleur match
        if (similarity.score > fileResult.bestScore) {
          fileResult.bestScore = similarity.score;
          fileResult.bestMatch = {
            fileName: fileName2,
            similarity: similarity.score,
            method: similarity.method,
            details: similarity.details
          };
        }
      }

      // Trier les comparaisons par score décroissant
      fileResult.targetComparisons.sort((a, b) => b.similarity - a.similarity);

      // Ne garder que les comparaisons significatives (> 0.2)
      fileResult.targetComparisons = fileResult.targetComparisons.filter(comp => comp.similarity > 0.2);

      if (fileResult.bestScore > 0.2) {
        significantComparisons++;
        fileComparisons.push(fileResult);
      }
    }

    console.log(`Total comparaisons: ${totalComparisons}`);
    console.log(`Comparaisons significatives: ${significantComparisons}`);

    // 3. CALCUL DU SCORE GLOBAL
    const averageFileScore = fileComparisons.length > 0
      ? fileComparisons.reduce((sum, comp) => sum + comp.bestScore, 0) / fileComparisons.length
      : 0;

    const globalScore = (structuralSimilarity * 0.3) + (averageFileScore * 0.7);

    // 4. IDENTIFICATION DES FICHIERS SUSPECTS
    const suspiciousFiles = fileComparisons.filter(comp => comp.bestScore >= 0.8);

    const result = {
      archive1: extractFileNameFromUrl(archive1Path),
      archive2: extractFileNameFromUrl(archive2Path),
      globalSimilarity: globalScore,
      structuralSimilarity: structuralSimilarity,
      averageFileScore: averageFileScore,
      statistics: {
        totalComparisons,
        significantComparisons,
        suspiciousFilesCount: suspiciousFiles.length,
        archive1Files: entries1.length,
        archive2Files: entries2.length
      },
      fileComparisons: fileComparisons.sort((a, b) => b.bestScore - a.bestScore),
      suspiciousFiles: suspiciousFiles.sort((a, b) => b.bestScore - a.bestScore),
      analyzedAt: new Date().toISOString()
    };

    return result;

  } catch (error) {
    console.error('Erreur dans compareArchivesInDetail:', error);
    throw error;
  }
};

const extractFileNameFromUrl = (url) => {
  try {
    // Pour les URLs Firebase, extraire le nom de fichier depuis le path
    if (url.includes('googleapis.com') || url.includes('firebase')) {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      // Le nom de fichier est généralement après "/o/" dans l'URL Firebase
      const fileName = pathParts[pathParts.length - 1];
      return decodeURIComponent(fileName);
    }
    // Fallback vers path.basename pour autres URLs
    return path.basename(url);
  } catch (error) {
    console.warn('Erreur extraction nom fichier depuis URL:', error.message);
    return path.basename(url);
  }
};

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

const getLanguageFromFileName = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.css': 'css',
    '.html': 'html',
    '.json': 'json',
    '.md': 'markdown',
    '.txt': 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
};

const analyzeStructuralSimilarity = (entries1, entries2) => {
  // Extraire les structures de dossiers
  const structure1 = new Set(entries1.map(e => path.dirname(e.entryName)));
  const structure2 = new Set(entries2.map(e => path.dirname(e.entryName)));

  // Extraire les noms de fichiers (sans chemins)
  const fileNames1 = new Set(entries1.map(e => path.basename(e.entryName)));
  const fileNames2 = new Set(entries2.map(e => path.basename(e.entryName)));

  // Calcul de similarité Jaccard pour la structure
  const structureIntersection = new Set([...structure1].filter(x => structure2.has(x)));
  const structureUnion = new Set([...structure1, ...structure2]);
  const structureScore = structureUnion.size > 0 ? structureIntersection.size / structureUnion.size : 0;

  // Calcul de similarité Jaccard pour les noms de fichiers
  const fileNamesIntersection = new Set([...fileNames1].filter(x => fileNames2.has(x)));
  const fileNamesUnion = new Set([...fileNames1, ...fileNames2]);
  const fileNamesScore = fileNamesUnion.size > 0 ? fileNamesIntersection.size / fileNamesUnion.size : 0;

  // Score combiné (50% structure, 50% noms de fichiers)
  return (structureScore * 0.5) + (fileNamesScore * 0.5);
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

const compareFileContents = async (content1, content2, fileName1, fileName2) => {
  try {
    // Détecter le type de fichier
    const type1 = detectFileTypeFromContent(content1, fileName1);
    const type2 = detectFileTypeFromContent(content2, fileName2);

    let similarity = 0;
    let method = 'unknown';
    let details = {};

    console.log(`Comparaison: ${fileName1} (${type1}) vs ${fileName2} (${type2})`);

    // Si les types sont différents, score faible mais pas nul
    if (type1 !== type2) {
      similarity = 0.1;
      method = 'type_mismatch';
      details = { type1, type2 };
    } else {
      // Utiliser l'algorithme approprié selon le type
      if (type1 === 'text' || type1 === 'code') {
        // Pour le code source : combinaison Levenshtein + N-grammes
        const levenshteinSim = calculateLevenshteinSimilarity(content1, content2);
        const ngramSim = calculateNgramSimilarity(content1, content2, 4);

        similarity = (levenshteinSim * 0.4) + (ngramSim * 0.6);
        method = 'hybrid_text';
        details = {
          levenshtein: levenshteinSim,
          ngram: ngramSim,
          length1: content1.length,
          length2: content2.length
        };
      } else {
        // Pour les autres types : N-grammes uniquement
        similarity = calculateNgramSimilarity(content1, content2, 3);
        method = 'ngram';
        details = {
          length1: content1.length,
          length2: content2.length
        };
      }
    }

    const result = {
      score: Math.max(0, Math.min(1, similarity)),
      method,
      details
    };

    console.log(`Résultat: ${result.score.toFixed(3)} (${method})`);
    return result;

  } catch (error) {
    console.error(`Erreur comparaison fichiers ${fileName1} vs ${fileName2}:`, error);
    return {
      score: 0,
      method: 'error',
      details: { error: error.message }
    };
  }
};

const getSubmissionContent = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  console.log('Récupération contenu soumission:', submissionId);

  try {
    // Récupérer la soumission
    const submission = await Submission.findByPk(submissionId, {
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: User, as: 'members' }]
        },
        {
          model: Deliverable,
          as: 'deliverable',
          include: [{
            model: Project,
            as: 'project'
          }]
        }
      ]
    });

    if (!submission) {
      return res.status(404).json({
        status: 'error',
        message: 'Soumission non trouvée'
      });
    }

    // Vérifications d'autorisation
    const isTeacher = userRole === 'teacher';
    const isGroupMember = submission.group.members.some(member => member.id === userId);
    const isProjectOwner = submission.deliverable.project.teacherId === userId;

    if (!isTeacher && !isGroupMember && !isProjectOwner) {
      return res.status(403).json({
        status: 'error',
        message: 'Vous n\'êtes pas autorisé à accéder à ce contenu'
      });
    }

    let content = '';
    let fileName = submission.fileName || 'unknown';
    let language = 'plaintext';
    let fileType = 'none';

    // Si c'est une soumission Git
    if (submission.gitUrl) {
      content = `# Repository Git\n# URL: ${submission.gitUrl}\n# Type: Dépôt Git\n\n// Pour voir le contenu, visitez le lien Git`;
      language = 'markdown';
      fileType = 'git';
    }
    // Si c'est un fichier uploadé
    else if (submission.filePath) {
      try {
        const { buffer, contentType } = await downloadFile(submission.filePath);

        // CORRECTION 1: Détecter les archives par extension ET contentType
        const isArchiveByExtension = ['.zip', '.rar', '.tar', '.gz', '.7z'].some(ext =>
          fileName.toLowerCase().endsWith(ext)
        );
        const isArchiveByContentType = contentType && (
          contentType === 'application/zip' ||
          contentType === 'application/x-zip-compressed' ||
          contentType === 'application/x-rar-compressed' ||
          contentType === 'application/gzip' ||
          contentType === 'application/x-tar'
        );

        console.log('Détection archive:', {
          fileName,
          contentType,
          isArchiveByExtension,
          isArchiveByContentType
        });

        // Si c'est une archive, donner un aperçu de la structure
        if (isArchiveByExtension || isArchiveByContentType) {
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries().filter(entry => !entry.isDirectory);

            const fileList = entries.slice(0, 20).map(entry => {
              const size = entry.header.size || entry.getData().length;
              const sizeStr = size > 1024 ? `${Math.round(size/1024)}KB` : `${size}B`;
              return `${entry.entryName} (${sizeStr})`;
            }).join('\n');

            const moreFiles = entries.length > 20 ? `\n... et ${entries.length - 20} autres fichiers` : '';

            content = `# Archive: ${fileName}
                      # Taille: ${buffer.length} bytes
                      # Nombre de fichiers: ${entries.length}
                      # Type détecté: ${contentType || 'archive'}

                      ## Structure de l'archive:

                          ${fileList}${moreFiles}

                      ## Pour voir le contenu détaillé:
                      # Utilisez l'analyse de similarité pour comparer avec d'autres archives
                      # et voir le contenu des fichiers individuels.`;

            language = 'markdown';
            fileType = 'archive';

            console.log(`Archive analysée: ${entries.length} fichiers trouvés`);
          } catch (zipError) {
            console.error('Erreur lecture archive:', zipError);
            content = `# Archive: ${fileName}\n# Taille: ${buffer.length} bytes\n# Erreur: Impossible de lire le contenu de l'archive\n# ${zipError.message}`;
            language = 'markdown';
            fileType = 'archive';
          }
        }
        // Pour les fichiers texte/code
        else {
          const detectedType = detectFileType(fileName);
          if (detectedType === 'text') {
            content = buffer.toString('utf8');
            language = getLanguageFromFileName(fileName);
            fileType = 'text';
          } else {
            content = `# Fichier binaire: ${fileName}\n# Taille: ${buffer.length} bytes\n# Type: ${contentType}\n\n// Aperçu non disponible pour les fichiers binaires`;
            language = 'markdown';
            fileType = 'binary';
          }
        }

      } catch (fileError) {
        console.error('Erreur lecture fichier:', fileError);
        content = `// Erreur lors de la lecture du fichier: ${fileName}\n// ${fileError.message}`;
        language = 'plaintext';
        fileType = 'error';
      }
    }
    // Aucun fichier trouvé
    else {
      content = '// Aucun fichier associé à cette soumission';
      language = 'markdown';
      fileType = 'none';
    }

    res.json({
      status: 'success',
      data: {
        content,
        fileName,
        language,
        type: fileType,
        fileSize: submission.fileSize,
        submissionDate: submission.submissionDate
      }
    });

  } catch (error) {
    console.error('Erreur getSubmissionContent:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la récupération du contenu'
    });
  }
});

const getDeliverableSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;

  const summary = await deliverableService.getDeliverableSummary(id, teacherId);

  // Ajouter des informations d'intégrité dans la réponse
  let missingFilesCount = 0;
  let totalFilesCount = 0;
  const missingFiles = [];

  summary.groupSummaries.forEach(groupSummary => {
    if (groupSummary.submission && groupSummary.submission.filePath && !groupSummary.submission.gitUrl) {
      totalFilesCount++;
      if (groupSummary.submission.fileExists === false) {
        missingFilesCount++;
        missingFiles.push({
          groupName: groupSummary.group.name,
          fileName: groupSummary.submission.fileName,
          submissionId: groupSummary.submission.id
        });
      }
    }
  });

  res.status(200).json({
    status: 'success',
    data: summary,
    integrity: {
      totalFiles: totalFilesCount,
      missingFiles: missingFilesCount,
      integrityScore: totalFilesCount > 0 ? Math.round(((totalFilesCount - missingFilesCount) / totalFilesCount) * 100) : 100,
      missingFilesList: missingFiles,
      hasIssues: missingFilesCount > 0
    }
  });
});

const sendDeadlineReminders = asyncHandler(async (req, res) => {
  const result = await deliverableService.sendDeadlineReminders();

  res.status(200).json({
    status: 'success',
    message: `${result.count} reminders sent`,
    data: result
  });
});

const downloadSubmissionFile = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const result = await deliverableService.downloadSubmissionFile(submissionId, userId, userRole);

    if (result.type === 'file') {
      res.set({
        'Content-Type': result.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': result.fileSize || 0,
        'Cache-Control': 'no-cache'
      });

      result.fileStream.on('error', (streamError) => {
        console.error('Erreur lors du streaming du fichier:', streamError);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Erreur lors du téléchargement du fichier'
          });
        }
      });

      result.fileStream.pipe(res);
    } else if (result.type === 'git') {
      return res.status(200).json({
        status: 'success',
        message: 'Soumission Git - redirection vers le dépôt',
        data: {
          type: 'git',
          gitUrl: result.gitUrl,
          repositoryName: result.fileName
        }
      });
    }

  } catch (error) {

    if (error.message.includes('non trouvé')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('non autorisé')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message
    });
  }
});

const deleteSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const result = await deliverableService.deleteSubmission(submissionId, userId, userRole);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: result.deletedSubmission
    });

  } catch (error) {

    if (error.message.includes('non trouvé')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('non autorisé') || error.message.includes('deadline')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la suppression de la soumission',
      error: error.message
    });
  }
});

const cleanMissingFiles = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await deliverableService.cleanMissingFiles(id);

    res.status(200).json({
      status: 'success',
      message: `Nettoyage terminé: ${result.cleanedCount} fichier(s) manquant(s) nettoyé(s)`,
      data: result
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors du nettoyage des fichiers manquants',
      error: error.message
    });
  }
});

// Endpoint pour obtenir un rapport d'intégrité simple
const getFileIntegrityReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const summary = await deliverableService.getDeliverableSummary(id);

    const report = {
      deliverableId: id,
      deliverableName: summary.deliverable.name,
      timestamp: new Date().toISOString(),
      files: [],
      summary: {
        totalSubmissions: 0,
        filesWithIssues: 0,
        gitSubmissions: 0,
        validFiles: 0
      }
    };

    summary.groupSummaries.forEach(groupSummary => {
      if (groupSummary.submission) {
        report.summary.totalSubmissions++;

        if (groupSummary.submission.gitUrl) {
          report.summary.gitSubmissions++;
          report.files.push({
            groupName: groupSummary.group.name,
            fileName: groupSummary.submission.fileName || 'Repository Git',
            type: 'git',
            status: 'ok',
            fileExists: true
          });
        } else if (groupSummary.submission.filePath) {
          const hasIssue = groupSummary.submission.fileExists === false;

          if (hasIssue) {
            report.summary.filesWithIssues++;
          } else {
            report.summary.validFiles++;
          }

          report.files.push({
            groupName: groupSummary.group.name,
            fileName: groupSummary.submission.fileName,
            type: 'file',
            status: hasIssue ? 'missing' : 'ok',
            fileExists: groupSummary.submission.fileExists,
            filePath: groupSummary.submission.filePath
          });
        }
      }
    });

    // Trier les fichiers problématiques en premier
    report.files.sort((a, b) => {
      if (a.status === 'missing' && b.status !== 'missing') return -1;
      if (a.status !== 'missing' && b.status === 'missing') return 1;
      return a.groupName.localeCompare(b.groupName);
    });

    res.status(200).json({
      status: 'success',
      data: report,
      message: report.summary.filesWithIssues > 0
        ? `⚠️ ${report.summary.filesWithIssues} fichier(s) manquant(s) détecté(s)`
        : '✅ Tous les fichiers sont présents'
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la génération du rapport d\'intégrité',
      error: error.message
    });
  }
});

module.exports = {
  createDeliverable,
  getDeliverableById,
  getProjectDeliverables,
  updateDeliverable,
  deleteDeliverable,
  submitDeliverable,
  analyzeSimilarity,
  getDeliverableSummary,
  sendDeadlineReminders,
  downloadSubmissionFile,
  deleteSubmission,
  cleanMissingFiles,
  getSubmissionContent,
  getFileIntegrityReport,

  analyzeArchivesSimilarity,
  compareArchivesInDetail,
  getArchiveFileContent,

  analyzeStructuralSimilarity,
  compareFileContents,
  isSystemFile,
  detectFileTypeFromContent,
  calculateLevenshteinSimilarity,
  calculateNgramSimilarity,
  getLanguageFromFileName,
  detectFileType
};

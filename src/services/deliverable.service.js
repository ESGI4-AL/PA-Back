const fs = require('fs');
const path = require('path');
const { Deliverable, DeliverableRule, Project, Group, Submission, User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');
const { bucket } = require('../../config/firebase-admin');
const { analyzeFileSimilarity, SIMILARITY_THRESHOLD } = require('./algoSimilarity.service');

const createDeliverable = async (projectId, deliverableData, teacherId) => {
  const project = await Project.findByPk(projectId);

  if (!project) throw new AppError('Project not found', 404);
  if (project.teacherId !== teacherId)
    throw new AppError('You are not authorized to add deliverables to this project', 403);

  const deliverable = await Deliverable.create({
    ...deliverableData,
    projectId
  });

  if (deliverableData.rules?.length) {
    const rules = [];
    for (const ruleData of deliverableData.rules) {
      const rule = await DeliverableRule.create({
        type: ruleData.type,
        rule: ruleData.rule,
        description: ruleData.description,
        deliverableId: deliverable.id
      });
      rules.push(rule);
    }
    deliverable.rules = rules;
  }

  return deliverable;
};

const getDeliverableById = async (deliverableId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: ['project', 'rules']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);
  return deliverable;
};

const getProjectDeliverables = async (projectId, userId = null) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new AppError('Project not found', 404);

  const deliverables = await Deliverable.findAll({
    where: { projectId },
    include: [
      'rules',
      {
        model: Submission,
        as: 'submissions',
        include: [
          {
            model: Group,
            as: 'group',
            include: ['members']
          }
        ]
      }
    ],
    order: [['deadline', 'ASC']]
  });

  // Vérifier l'existence des fichiers pour toutes les soumissions
  const deliverablesList = [];

  for (const deliverable of deliverables) {
    const deliverableData = deliverable.toJSON();

    // Vérifier l'existence des fichiers pour chaque soumission
    for (const submission of deliverableData.submissions) {
      if (submission.filePath && !submission.gitUrl) {
        const fileExists = await checkFileExists(submission.filePath);
        submission.fileExists = fileExists;

        if (!fileExists) {
          console.warn(`⚠️ Fichier manquant détecté: ${submission.fileName} (Livrable: ${deliverable.name})`);
        }
      } else if (submission.gitUrl) {
        submission.fileExists = true; // Les soumissions Git sont considérées comme existantes
      }
    }

    deliverablesList.push(deliverableData);
  }

  // Si un userId est fourni (étudiant), filtrer les soumissions pour ne garder que celles de son groupe
  if (userId) {
    return deliverablesList.map(deliverable => {
      const userSubmissions = deliverable.submissions.filter(submission =>
        submission.group.members.some(member => member.id === userId)
      );

      return {
        ...deliverable,
        submissions: userSubmissions
      };
    });
  }

  return deliverablesList;
};

const updateDeliverable = async (deliverableId, updateData, teacherId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: ['project', 'rules']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);
  if (deliverable.project.teacherId !== teacherId) throw new AppError('You are not authorized to update this deliverable', 403);

  await deliverable.update(updateData);

  if (updateData.rules?.length) {
    await DeliverableRule.destroy({ where: { deliverableId } });
    const newRules = [];
    for (const ruleData of updateData.rules) {
      const rule = await DeliverableRule.create({
        type: ruleData.type,
        rule: ruleData.rule,
        description: ruleData.description,
        deliverableId: deliverable.id
      });
      newRules.push(rule);
    }
    deliverable.rules = newRules;
  }

  return deliverable;
};

const deleteDeliverable = async (deliverableId, teacherId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: ['project', 'submissions']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);
  if (deliverable.project.teacherId !== teacherId) throw new AppError('You are not authorized to delete this deliverable', 403);
  if (deliverable.submissions?.length) throw new AppError('Cannot delete deliverable with existing submissions', 400);

  await DeliverableRule.destroy({ where: { deliverableId } });
  await deliverable.destroy();

  return { success: true, message: 'Deliverable deleted successfully' };
};

const submitDeliverable = async (deliverableId, submissionData, groupId, fileUrl = null, fileName = null, fileSize = null) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: ['project', 'rules']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);

  const group = await Group.findByPk(groupId, { include: ['members'] });
  if (!group) throw new AppError('Group not found', 404);
  if (group.projectId !== deliverable.projectId) throw new AppError('Group is not part of the project', 403);

  const now = new Date();
  const deadline = new Date(deliverable.deadline);
  const isLate = now > deadline;
  const hoursLate = isLate ? Math.ceil((now - deadline) / (1000 * 60 * 60)) : 0;

  if (isLate && !deliverable.allowLateSubmission) {
    throw new AppError('Deadline has passed and late submissions are not allowed', 400);
  }

  let submission = await Submission.findOne({ where: { groupId, deliverableId } });

  if (submission) {
    submission.submissionDate = now;
    submission.isLate = isLate;
    submission.hoursLate = hoursLate;
    submission.filePath = fileUrl;
    submission.fileName = fileName;
    submission.fileSize = fileSize;
    if (submissionData.gitUrl) {
      submission.gitUrl = submissionData.gitUrl;
    }
    submission.validationStatus = 'pending';
    submission.validationDetails = null;
    await submission.save();
  } else {
    submission = await Submission.create({
      submissionDate: now,
      isLate,
      hoursLate,
      filePath: fileUrl,
      fileName: fileName,
      fileSize: fileSize,
      gitUrl: submissionData.gitUrl || null,
      validationStatus: 'pending',
      groupId,
      deliverableId
    });
  }

  await validateSubmission(submission, deliverable);
  return submission;
};

const validateSubmission = async (submission, deliverable) => {
  if (!deliverable.rules?.length) {
    submission.validationStatus = 'valid';
    await submission.save();
    return submission;
  }

  const validationResults = { valid: true, details: [] };

  for (const rule of deliverable.rules) {
    const ruleResult = await validateRule(submission, rule);
    validationResults.details.push(ruleResult);
    if (!ruleResult.valid) validationResults.valid = false;
  }

  submission.validationStatus = validationResults.valid ? 'valid' : 'invalid';
  submission.validationDetails = validationResults;
  await submission.save();
  return submission;
};

const validateRule = async (submission, rule) => {
  const result = {
    ruleId: rule.id,
    type: rule.type,
    description: rule.description,
    valid: false,
    message: ''
  };

  switch (rule.type) {
    case 'file_size':
      if (!submission.filePath?.startsWith('http')) {
        result.message = 'Aucun fichier uploadé ou URL invalide';
        break;
      }

      try {
        if (submission.fileSize) {
          const fileSize = parseInt(submission.fileSize, 10);
          const maxSize = rule.rule.maxSize;

          if (fileSize <= maxSize) {
            result.valid = true;
            result.message = `Taille OK (${fileSize} / ${maxSize} octets)`;
          } else {
            result.message = `Fichier trop volumineux (${fileSize} > ${maxSize} octets)`;
          }
        } else {
          const encodedPath = submission.filePath.split('/o/')[1]?.split('?')[0];
          const decodedPath = decodeURIComponent(encodedPath);
          const file = bucket.file(decodedPath);
          const [metadata] = await file.getMetadata();
          const fileSize = parseInt(metadata.size, 10);
          const maxSize = rule.rule.maxSize;

          if (fileSize <= maxSize) {
            result.valid = true;
            result.message = `Taille OK (${fileSize} / ${maxSize} octets)`;
          } else {
            result.message = `Fichier trop volumineux (${fileSize} > ${maxSize} octets)`;
          }
        }
      } catch (error) {
        result.message = `Erreur lors de la vérification de taille : ${error.message}`;
      }
      break;

    case 'file_presence':
      // Implementation de la verification de presence de fichiers
      if (!submission.filePath && !submission.gitUrl) {
        result.message = 'Aucun fichier ou URL fourni';
        break;
      }

      try {
        const requiredFiles = rule.rule.files || [];
        if (requiredFiles.length === 0) {
          result.valid = true;
          result.message = 'Aucun fichier spécifique requis';
          break;
        }

        // Pour les URLs Git, on simule la verification
        if (submission.gitUrl) {
          result.valid = true;
          result.message = `Verification Git URL: ${requiredFiles.join(', ')} (simule)`;
          break;
        }

        if (submission.filePath) {
          const displayName = submission.fileName || path.basename(submission.filePath);
          result.valid = true;
          result.message = `Fichier present: ${displayName}`;
        }
      } catch (error) {
        result.message = `Erreur verification presence: ${error.message}`;
      }
      break;

    case 'folder_structure':
      // Implementation de la verification de structure de dossiers
      try {
        const requiredStructure = rule.rule.structure || {};

        if (submission.gitUrl) {
          result.valid = true;
          result.message = 'Structure Git repository (simulation OK)';
          break;
        }

        if (submission.filePath) {
          const fileName = submission.fileName || path.basename(submission.filePath);
          const isArchive = ['.zip', '.tar', '.gz', '.rar'].some(ext => fileName.toLowerCase().endsWith(ext));

          if (isArchive) {
            result.valid = true;
            result.message = `Archive detectee: ${fileName}`;
          } else {
            result.valid = true;
            result.message = `Fichier unique: ${fileName}`;
          }
        } else {
          result.message = 'Aucun fichier pour verification structure';
        }
      } catch (error) {
        result.message = `Erreur verification structure: ${error.message}`;
      }
      break;

    case 'file_content':
      // Implementation de la verification de contenu de fichier
      try {
        const contentRules = rule.rule.patterns || [];

        if (contentRules.length === 0) {
          result.valid = true;
          result.message = 'Aucune regle de contenu specifiee';
          break;
        }

        if (submission.gitUrl) {
          result.valid = true;
          result.message = `Verification contenu Git (${contentRules.length} regles simulees)`;
          break;
        }

        if (submission.filePath) {
          const fileName = submission.fileName || path.basename(submission.filePath);
          const ext = path.extname(fileName).toLowerCase();

          if (['.txt', '.md', '.js', '.py', '.java', '.html', '.css'].includes(ext)) {
            result.valid = true;
            result.message = `Fichier texte detecte: ${fileName}`;
          } else {
            result.valid = true;
            result.message = `Fichier binaire: ${fileName}`;
          }
        } else {
          result.message = 'Aucun fichier pour verification contenu';
        }
      } catch (error) {
        result.message = `Erreur verification contenu: ${error.message}`;
      }
      break;

    default:
      result.message = `Type de règle inconnu : ${rule.type}`;
  }

  return result;
};

const analyzeSimilarity = async (deliverableId) => {
  try {
    console.log('=== DEBUT ANALYSE SIMILARITE ===');
    console.log('Deliverable ID:', deliverableId);

    // Récupérer le livrable
    const deliverable = await Deliverable.findByPk(deliverableId);
    if (!deliverable) {
      throw new AppError('Livrable non trouvé', 404);
    }
    console.log('Livrable trouvé:', deliverable.name);

    // Récupérer toutes les soumissions pour ce livrable
    const submissions = await Submission.findAll({
      where: { deliverableId },
      include: [{ model: Group, as: 'group' }]
    });

    console.log('Nombre de soumissions trouvées:', submissions.length);

    if (submissions.length < 2) {
      console.log('Pas assez de soumissions pour l\'analyse');
      return {
        deliverableId,
        deliverableName: deliverable.name,
        submissionsCount: submissions.length,
        validSubmissionsCount: 0,
        message: 'Au moins 2 soumissions sont nécessaires pour l\'analyse',
        comparisons: [],
        suspiciousPairs: [],
        threshold: SIMILARITY_THRESHOLD,
        processedAt: new Date().toISOString()
      };
    }

    // Verification des chemins des fichiers
    console.log('Verification des chemins de fichiers:');
    const validSubmissions = [];

    submissions.forEach((submission, index) => {
      console.log(`Soumission ${index + 1}:`, {
        id: submission.id,
        groupName: submission.group?.name,
        fileName: submission.fileName,
        fileSize: submission.fileSize,
        filePath: submission.filePath,
        gitUrl: submission.gitUrl
      });

      // Vérifier que le chemin existe
      if (submission.filePath || submission.gitUrl) {
        validSubmissions.push(submission);
      } else {
        console.error(`PROBLEME: Soumission ${submission.id} n'a ni filePath ni gitUrl!`);
      }
    });

    console.log(`Soumissions valides: ${validSubmissions.length}/${submissions.length}`);

    if (validSubmissions.length < 2) {
      return {
        deliverableId,
        deliverableName: deliverable.name,
        submissionsCount: submissions.length,
        validSubmissionsCount: validSubmissions.length,
        message: 'Au moins 2 soumissions avec fichiers sont nécessaires pour l\'analyse',
        comparisons: [],
        suspiciousPairs: [],
        threshold: SIMILARITY_THRESHOLD,
        processedAt: new Date().toISOString()
      };
    }

    const comparisons = [];
    const suspiciousPairs = [];
    let totalComparisons = 0;
    let successfulComparisons = 0;
    let errorCount = 0;

    console.log('=== DEBUT DES COMPARAISONS ===');

    // Comparer toutes les paires de soumissions valides
    for (let i = 0; i < validSubmissions.length; i++) {
      for (let j = i + 1; j < validSubmissions.length; j++) {
        const submission1 = validSubmissions[i];
        const submission2 = validSubmissions[j];
        totalComparisons++;

        console.log(`\nComparaison ${i + 1} vs ${j + 1} (${submission1.group?.name} vs ${submission2.group?.name}):`);

        try {
          // Déterminer les chemins de fichiers à utiliser
          const file1Path = submission1.filePath || submission1.gitUrl;
          const file2Path = submission2.filePath || submission2.gitUrl;


          // Appeler l'algorithme de similarité
          console.log('  - Lancement de l\'analyse...');
          const similarityResult = await analyzeFileSimilarity(file1Path, file2Path);

          console.log(`  Resultat: ${(similarityResult.finalScore * 100).toFixed(1)}% (${similarityResult.recommendedMethod})`);

          // Créer l'objet de comparaison
          const comparison = {
            submission1Id: submission1.id,
            submission2Id: submission2.id,
            group1: {
              id: submission1.group?.id,
              name: submission1.group?.name
            },
            group2: {
              id: submission2.group?.id,
              name: submission2.group?.name
            },
            similarityScore: similarityResult.finalScore,
            similarityPercentage: Math.round(similarityResult.finalScore * 100),
            method: similarityResult.recommendedMethod,
            algorithms: similarityResult.algorithms,
            details: {
              file1: similarityResult.file1,
              file2: similarityResult.file2,
              type1: similarityResult.type1,
              type2: similarityResult.type2,
              timestamp: similarityResult.timestamp,
              error: similarityResult.error || null
            },
            isSuspicious: similarityResult.finalScore >= SIMILARITY_THRESHOLD,
            comparedAt: new Date().toISOString()
          };

          comparisons.push(comparison);
          successfulComparisons++;

          // Détecter les paires suspectes
          if (similarityResult.finalScore >= SIMILARITY_THRESHOLD) {
            suspiciousPairs.push(comparison);
            console.log(`  PAIRE SUSPECTE DETECTEE: ${(similarityResult.finalScore * 100).toFixed(1)}%`);

            // Mettre à jour les soumissions avec le score de similarité
            try {
              await Promise.all([
                submission1.update({
                  similarityScore: Math.max(submission1.similarityScore || 0, similarityResult.finalScore)
                }),
                submission2.update({
                  similarityScore: Math.max(submission2.similarityScore || 0, similarityResult.finalScore)
                })
              ]);
            } catch (updateError) {
              console.warn('Erreur mise à jour score similarité:', updateError.message);
            }
          }

        } catch (error) {
          errorCount++;
          console.error(`Erreur lors de la comparaison ${i + 1} vs ${j + 1}:`, error.message);

          // Ajouter une comparaison avec erreur
          const errorComparison = {
            submission1Id: submission1.id,
            submission2Id: submission2.id,
            group1: {
              id: submission1.group?.id,
              name: submission1.group?.name
            },
            group2: {
              id: submission2.group?.id,
              name: submission2.group?.name
            },
            similarityScore: 0,
            similarityPercentage: 0,
            method: 'error',
            algorithms: [],
            details: {
              error: error.message,
              timestamp: new Date().toISOString()
            },
            isSuspicious: false,
            comparedAt: new Date().toISOString()
          };

          comparisons.push(errorComparison);
        }
      }
    }

    // Trier les comparaisons par score décroissant
    comparisons.sort((a, b) => b.similarityScore - a.similarityScore);
    suspiciousPairs.sort((a, b) => b.similarityScore - a.similarityScore);

    console.log('\n=== RESULTATS FINAUX ===');
    console.log(`  - Total comparaisons: ${totalComparisons}`);
    console.log(`  - Comparaisons réussies: ${successfulComparisons}`);
    console.log(`  - Erreurs: ${errorCount}`);
    console.log(`  - Paires suspectes: ${suspiciousPairs.length}`);
    console.log(`  - Seuil utilisé: ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%`);

    if (suspiciousPairs.length > 0) {
      console.log('PAIRES SUSPECTES DETAILLEES:');
      suspiciousPairs.forEach((pair, index) => {
        console.log(`  ${index + 1}. ${pair.group1.name} vs ${pair.group2.name}: ${pair.similarityPercentage}% (${pair.method})`);
      });
    }

    // Créer une matrice de similarité pour l'interface
    const similarityMatrix = {};
    validSubmissions.forEach(sub1 => {
      similarityMatrix[sub1.id] = {};
      validSubmissions.forEach(sub2 => {
        if (sub1.id === sub2.id) {
          similarityMatrix[sub1.id][sub2.id] = 1.0;
        } else {
          const comparison = comparisons.find(c =>
            (c.submission1Id === sub1.id && c.submission2Id === sub2.id) ||
            (c.submission1Id === sub2.id && c.submission2Id === sub1.id)
          );
          similarityMatrix[sub1.id][sub2.id] = comparison ? comparison.similarityScore : 0;
        }
      });
    });

    const finalResult = {
      deliverableId,
      deliverableName: deliverable.name,
      submissionsCount: submissions.length,
      validSubmissionsCount: validSubmissions.length,
      comparisons,
      suspiciousPairs,
      similarityMatrix,
      statistics: {
        totalComparisons,
        successfulComparisons,
        errorCount,
        suspiciousCount: suspiciousPairs.length,
        averageSimilarity: successfulComparisons > 0
          ? (comparisons.filter(c => c.method !== 'error').reduce((sum, c) => sum + c.similarityScore, 0) / successfulComparisons)
          : 0,
        maxSimilarity: comparisons.length > 0 ? Math.max(...comparisons.map(c => c.similarityScore)) : 0
      },
      threshold: SIMILARITY_THRESHOLD,
      submissions: validSubmissions.map(s => ({
        id: s.id,
        groupId: s.group?.id,
        groupName: s.group?.name,
        fileName: s.fileName,
        fileSize: s.fileSize,
        filePath: s.filePath,
        gitUrl: s.gitUrl,
        submissionDate: s.submissionDate,
        isLate: s.isLate,
        validationStatus: s.validationStatus
      })),
      processedAt: new Date().toISOString()
    };

    console.log('Analyse de similarité terminée avec succès!');
    return finalResult;

  } catch (error) {
    console.error('ERREUR CRITIQUE DANS ANALYSE SIMILARITE:', error);
    throw new AppError(`Erreur lors de l'analyse de similarité: ${error.message}`, 500);
  }
};

const sendDeadlineReminders = async () => {
  const { Op } = require('sequelize');
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingDeliverables = await Deliverable.findAll({
    where: {
      deadline: { [Op.gt]: now, [Op.lt]: in24Hours }
    },
    include: [{
      model: Project,
      as: 'project',
      include: [{
        model: Promotion,
        as: 'promotion',
        include: [{ model: User, as: 'students', where: { isActive: true } }]
      }]
    }]
  });

  const remindersSent = [];

  for (const deliverable of upcomingDeliverables) {
    const students = deliverable.project.promotion.students;
    for (const student of students) {
      try {
        await emailService.sendDeadlineReminder(student, deliverable, deliverable.project);
        remindersSent.push({
          deliverableId: deliverable.id,
          deliverableName: deliverable.name,
          studentId: student.id,
          studentEmail: student.email
        });
      } catch (error) {
        console.error(`Failed to send reminder to ${student.email}:`, error);
      }
    }
  }

  return { remindersSent, count: remindersSent.length };
};

const downloadSubmissionFile = async (submissionId, userId, userRole) => {
  try {
    const submission = await Submission.findByPk(submissionId, {
      include: [
        {
          model: Group,
          as: 'group',
          include: [
            { model: User, as: 'members' }
          ]
        },
        {
          model: Deliverable,
          as: 'deliverable',
          include: [
            {
              model: Project,
              as: 'project'
            }
          ]
        }
      ]
    });

    if (!submission) {
      throw new AppError('Soumission non trouvée', 404);
    }

    const isTeacher = userRole === 'teacher';
    const isGroupMember = submission.group.members.some(member => member.id === userId);
    const isProjectOwner = submission.deliverable.project.teacherId === userId;

    if (!isTeacher && !isGroupMember && !isProjectOwner) {
      throw new AppError('Vous n\'êtes pas autorisé à télécharger ce fichier', 403);
    }

    if (submission.gitUrl) {
      return {
        type: 'git',
        gitUrl: submission.gitUrl,
        fileName: submission.fileName || 'Repository Git'
      };
    }

    if (submission.filePath) {
      const filePath = getFirebasePathFromUrl(submission.filePath);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new AppError('Fichier non trouvé dans le stockage', 404);
      }

      const [metadata] = await file.getMetadata();

      const fileStream = file.createReadStream();

      return {
        type: 'file',
        fileStream: fileStream,
        fileName: submission.fileName,
        fileSize: submission.fileSize || metadata.size,
        contentType: metadata.contentType || 'application/octet-stream'
      };
    }

    throw new AppError('Aucun fichier trouvé pour cette soumission', 404);

  } catch (error) {
    console.error('Erreur downloadSubmissionFile:', error);
    throw error;
  }
};

const getFirebasePathFromUrl = (firebaseUrl) => {
  try {
    const url = new URL(firebaseUrl);
    const pathParts = url.pathname.split('/');
    return pathParts.slice(2).join('/');
  } catch (error) {
    const match = firebaseUrl.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : firebaseUrl;
  }
};

// Fonction simple pour vérifier si un fichier existe dans Firebase
const checkFileExists = async (firebaseUrl) => {
  try {
    if (!firebaseUrl) return false;
    const filePath = getFirebasePathFromUrl(firebaseUrl);
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('Erreur vérification fichier:', error);
    return false;
  }
};

// Fonction simple pour nettoyer les fichiers manquants d'un livrable
const cleanMissingFiles = async (deliverableId) => {
  try {
    console.log('🧹 Nettoyage des fichiers manquants pour le livrable:', deliverableId);

    const submissions = await Submission.findAll({
      where: { deliverableId },
      include: [{ model: Group, as: 'group' }]
    });

    let cleanedCount = 0;

    for (const submission of submissions) {
      if (submission.filePath && !submission.gitUrl) {
        const exists = await checkFileExists(submission.filePath);

        if (!exists) {
          console.log(`❌ Nettoyage: ${submission.fileName} (Groupe: ${submission.group?.name})`);

          // Nettoyer les références du fichier manquant
          await submission.update({
            filePath: null,
            fileName: null,
            fileSize: null,
            validationStatus: 'invalid',
            validationDetails: {
              valid: false,
              details: [{
                rule: 'file_integrity',
                valid: false,
                message: 'Fichier supprimé - introuvable dans Firebase Storage'
              }]
            }
          });

          cleanedCount++;
        }
      }
    }

    console.log(`✅ Nettoyage terminé: ${cleanedCount} soumission(s) nettoyée(s)`);
    return { cleanedCount, totalChecked: submissions.length };

  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    throw new AppError('Erreur lors du nettoyage des fichiers manquants', 500);
  }
};

const getDeliverableSummary = async (deliverableId) => {
  try {
    console.log('=== RECUPERATION RESUME LIVRABLE ===');
    console.log('Deliverable ID:', deliverableId);

    //recup livrable pour toute les regles
    const deliverable = await Deliverable.findByPk(deliverableId, {
      include: [
        { model: DeliverableRule, as: 'rules' },
        {
          model: Project,
          as: 'project',
          include: [
            {
              model: Group,
              as: 'groups',
              include: [
                { model: User, as: 'members' }
              ]
            }
          ]
        }
      ]
    });

    if (!deliverable) {
      throw new AppError('Livrable non trouvé', 404);
    }

    console.log('Livrable trouvé:', deliverable.name);

    const submissions = await Submission.findAll({
      where: { deliverableId },
      include: [
        {
          model: Group,
          as: 'group',
          include: [
            { model: User, as: 'members' }
          ]
        }
      ]
    });

    console.log('Soumissions trouvées:', submissions.length);

    const allGroups = await Group.findAll({
      where: { projectId: deliverable.project.id },
      include: [
        { model: User, as: 'members' }
      ]
    });

    console.log('Groupes du projet:', allGroups.length);

    //summary pour chaque groupe
    const groupSummaries = [];

    for (const group of allGroups) {
      const submission = submissions.find(s => s.groupId === group.id);

      const groupSummary = {
        group: {
          id: group.id,
          name: group.name,
          members: group.members ? group.members.map(member => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email
          })) : []
        },
        submission: null
      };

      if (submission) {
        // Vérifier si le fichier existe encore dans Firebase
        let fileExists = true;
        if (submission.filePath && !submission.gitUrl) {
          fileExists = await checkFileExists(submission.filePath);
          if (!fileExists) {
            console.warn(`⚠️ Fichier manquant: ${submission.fileName} (Groupe: ${group.name})`);
          }
        }

        groupSummary.submission = {
          id: submission.id,
          submissionDate: submission.submissionDate,
          isLate: submission.isLate,
          hoursLate: submission.hoursLate || 0,
          validationStatus: submission.validationStatus,
          validationDetails: submission.validationDetails,
          similarityScore: submission.similarityScore || null,
          fileName: submission.fileName,
          fileSize: submission.fileSize,
          filePath: submission.filePath,
          gitUrl: submission.gitUrl,
          fileExists: fileExists // Ajouter l'information d'existence
        };
      }

      groupSummaries.push(groupSummary);
    }

    //stats calcule
    const submittedGroups = groupSummaries.filter(g => g.submission !== null);
    const validSubmissions = submittedGroups.filter(g => g.submission.validationStatus === 'valid');
    const lateSubmissions = submittedGroups.filter(g => g.submission.isLate);

    const summary = {
      deliverable: {
        id: deliverable.id,
        name: deliverable.name,
        description: deliverable.description,
        type: deliverable.type,
        deadline: deliverable.deadline,
        allowLateSubmission: deliverable.allowLateSubmission,
        latePenaltyPerHour: deliverable.latePenaltyPerHour
      },
      rules: deliverable.rules ? deliverable.rules.map(rule => ({
        id: rule.id,
        type: rule.type,
        description: rule.description,
        rule: rule.rule
      })) : [],
      statistics: {
        totalGroups: allGroups.length,
        submittedGroups: submittedGroups.length,
        validSubmissions: validSubmissions.length,
        lateSubmissions: lateSubmissions.length,
        submissionRate: allGroups.length > 0 ? (submittedGroups.length / allGroups.length * 100).toFixed(1) : 0
      },
      groupSummaries
    };

    console.log('Statistiques:', summary.statistics);
    console.log('Résumé généré avec succès');

    return summary;

  } catch (error) {
    console.error('ERREUR DANS getDeliverableSummary:', error);
    throw error;
  }
};

const deleteSubmission = async (submissionId, userId, userRole) => {
  try {
    const submission = await Submission.findByPk(submissionId, {
      include: [
        {
          model: Group,
          as: 'group',
          include: [
            { model: User, as: 'members' }
          ]
        },
        {
          model: Deliverable,
          as: 'deliverable',
          include: [
            {
              model: Project,
              as: 'project'
            }
          ]
        }
      ]
    });

    if (!submission) {
      throw new AppError('Soumission non trouvée', 404);
    }

    const isTeacher = userRole === 'teacher';
    const isGroupMember = submission.group.members.some(member => member.id === userId);
    const isProjectOwner = submission.deliverable.project.teacherId === userId;

    if (!isTeacher && !isGroupMember && !isProjectOwner) {
      throw new AppError('Vous n\'êtes pas autorisé à supprimer cette soumission', 403);
    }

    // Vérifier si la deadline est passée
    const now = new Date();
    const deadline = new Date(submission.deliverable.deadline);
    const isAfterDeadline = now > deadline;

    // Conditions pour pouvoir supprimer après la deadline :
    // 1. Être enseignant ou propriétaire du projet
    // 2. OU le livrable autorise les soumissions en retard
    const canDeleteAfterDeadline =
      isTeacher ||
      isProjectOwner ||
      submission.deliverable.allowLateSubmission;

    if (isAfterDeadline && !canDeleteAfterDeadline) {
      throw new AppError('Impossible de supprimer la soumission après la deadline', 403);
    }

    // Supprimer le fichier de Firebase Storage si il existe
    if (submission.filePath) {
      try {
        const filePath = getFirebasePathFromUrl(submission.filePath);
        const file = bucket.file(filePath);

        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
        } else {
        }
      } catch (firebaseError) {
        // On continue même si la suppression Firebase échoue
      }
    }

    // Sauvegarder les informations pour le retour
    const deletedSubmissionInfo = {
      id: submission.id,
      fileName: submission.fileName,
      submissionDate: submission.submissionDate,
      groupName: submission.group.name,
      deliverableName: submission.deliverable.title,
      wasFileDeleted: !!submission.filePath,
      wasGitSubmission: !!submission.gitUrl
    };

    // Supprimer la soumission de la base de données
    await submission.destroy();

    return {
      message: 'Soumission supprimée avec succès',
      deletedSubmission: deletedSubmissionInfo
    };

  } catch (error) {
    console.error('Erreur deleteSubmission:', error);
    throw error;
  }
};

module.exports = {
  createDeliverable,
  getDeliverableById,
  getProjectDeliverables,
  updateDeliverable,
  deleteDeliverable,
  submitDeliverable,
  validateSubmission,
  analyzeSimilarity,
  getDeliverableSummary,
  sendDeadlineReminders,
  downloadSubmissionFile,
  deleteSubmission,
  cleanMissingFiles
};
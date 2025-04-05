const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { User, Promotion, Project, Group, Grade } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

//random password generator for user
const generateRandomPassword = () => {
  return Math.random().toString(36).slice(-10);
};

//create user, only teacher can do that
const createUser = async (userData) => {
  //mail already exists ?
  const existingUser = await User.findOne({ where: { email: userData.email } });
  
  if (existingUser) {
    //is user alrrady exist,update information
    if (userData.promotionId && userData.promotionId !== existingUser.promotionId) {
      existingUser.promotionId = userData.promotionId;
      await existingUser.save();
    }
    return existingUser;
  }
  
  if (!userData.password) {
    userData.password = generateRandomPassword();
  }
  
  const user = await User.create(userData);
  
  //send welcome email with connexion information
  try {
    await emailService.sendWelcomeEmail(user);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
  
  return user;
};

const importUsers = async (usersData, promotionId) => {
  const promotion = await Promotion.findByPk(promotionId);
  
  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }
  
  const results = {
    created: [],
    updated: [],
    failed: [],
    totalProcessed: usersData.length
  };
  
  for (const userData of usersData) {
    try {
      if (!userData.email || !userData.firstName || !userData.lastName) {
        results.failed.push({
          userData,
          error: 'Missing required fields (email, firstName, lastName)'
        });
        continue;
      }
      
      let user = await User.findOne({ where: { email: userData.email } });
      
      if (user) {
        //update promotion
        user.promotionId = promotionId;
        await user.save();
        results.updated.push(user);
      } else {
        // create new user 
        const password = generateRandomPassword();
        user = await User.create({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'student',
          password,
          promotionId
        });
        
        try {
          await emailService.sendWelcomeEmail(user, password);
        } catch (error) {
          console.error(`Failed to send welcome email to ${user.email}:`, error);
        }
        
        results.created.push(user);
      }
    } catch (error) {
      results.failed.push({
        userData,
        error: error.message
      });
    }
  }
  
  return results;
};

//pars e import file (CSV or JSON)
const parseImportFile = async (file, fileType) => {
  try {
    let usersData = [];
    
    if (fileType === 'csv') {
      const csvContent = file.buffer.toString('utf8');
      const rows = csvContent.split('\n');
      const headers = rows[0].split(',').map(header => header.trim());
      
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        
        const values = rows[i].split(',').map(value => value.trim());
        const userData = {};
        
        headers.forEach((header, index) => {
          userData[header] = values[index];
        });
        
        usersData.push(userData);
      }
    } else if (fileType === 'json') {
      const jsonContent = file.buffer.toString('utf8');
      usersData = JSON.parse(jsonContent);
      
      if (!Array.isArray(usersData)) {
        usersData = [usersData];
      }
    } else {
      throw new AppError('Unsupported file format', 400);
    }
    
    return usersData;
  } catch (error) {
    throw new AppError(`Failed to parse file: ${error.message}`, 400);
  }
};

const getUserById = async (id) => {
  const user = await User.findByPk(id, {
    include: [
      {
        model: Promotion,
        as: 'promotion'
      }
    ]
  });
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  return user;
};

//get all users with filters
const getAllUsers = async (filters = {}) => {
  const { role, promotionId, search, page = 1, limit = 10 } = filters;
  
  const whereClause = {};
  
  if (role) {
    whereClause.role = role;
  }
  
  if (promotionId) {
    whereClause.promotionId = promotionId;
  }
  
  if (search) {
    whereClause[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  const { count, rows } = await User.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Promotion,
        as: 'promotion'
      }
    ],
    offset: (page - 1) * limit,
    limit,
    order: [['lastName', 'ASC'], ['firstName', 'ASC']]
  });
  
  return {
    users: rows,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page)
  };
};

//get user projects
const getUserProjects = async (userId) => {
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  let projects = [];
  
  if (user.role === 'teacher') {
    //for teachers, get all projects they are associated with
    projects = await Project.findAll({
      where: { teacherId: userId },
      order: [['createdAt', 'DESC']]
    });
  } else {
    //for students, get projects from their promotion
    //and projects from groups they are members of
    const promotionProjects = user.promotionId 
      ? await Project.findAll({
          where: { 
            promotionId: user.promotionId,
            status: 'visible'
          }
        }) 
      : [];
      
    //find groups the user is a member of
    const groups = await Group.findAll({
      include: [
        {
          model: User,
          as: 'members',
          where: { id: userId }
        },
        {
          model: Project,
          as: 'project'
        }
      ]
    });
    
    const groupProjects = groups.map(group => group.project);
    
    //combine and dupolicate projects
    const allProjects = [...promotionProjects, ...groupProjects];
    const uniqueProjects = [];
    const projectIds = new Set();
    
    for (const project of allProjects) {
      if (!projectIds.has(project.id)) {
        projectIds.add(project.id);
        uniqueProjects.push(project);
      }
    }
    
    projects = uniqueProjects;
  }
  
  return projects;
};

//update user
const updateUser = async (id, updateData) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (updateData.email && updateData.email !== user.email) {
    const existingUser = await User.findOne({ where: { email: updateData.email } });
    
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }
  }
  
  if (user.role === 'teacher' && updateData.role === 'student') {
    const teacherProjects = await Project.count({ where: { teacherId: id } });
    
    if (teacherProjects > 0) {
      throw new AppError('Cannot change role: Teacher has associated projects', 400);
    }
  }
  
  await user.update(updateData);
  
  return user;
};

const deactivateUser = async (id) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  user.isActive = false;
  await user.save();
  
  return { success: true, message: 'User deactivated successfully' };
};

const activateUser = async (id) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  user.isActive = true;
  await user.save();
  
  return { success: true, message: 'User activated successfully' };
};

const changePassword = async (id, currentPassword, newPassword) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  if (currentPassword) {
    const isValid = await user.isValidPassword(currentPassword);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 401);
    }
  }
  
  user.password = newPassword;
  await user.save();
  
  return { success: true, message: 'Password changed successfully' };
};

//reset user password only for teachers
const resetUserPassword = async (id) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  const newPassword = generateRandomPassword();
  
  user.password = newPassword;
  await user.save();
  
  try {
    await emailService.sendPasswordResetEmail(user, newPassword);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }
  
  return {
    success: true,
    message: 'Password reset successfully',
    tempPassword: newPassword
  };
};

//get student grades
const getStudentGrades = async (studentId) => {
  const user = await User.findByPk(studentId);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  if (user.role !== 'student') {
    throw new AppError('User is not a student', 400);
  }
  
  //get individual grades
  const individualGrades = await Grade.findAll({
    where: { studentId },
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: EvaluationCriteria,
        as: 'criteria'
      }
    ]
  });
  
  //get groups the student is a member of
  const groups = await Group.findAll({
    include: [
      {
        model: User,
        as: 'members',
        where: { id: studentId }
      }
    ]
  });
  
  const groupIds = groups.map(group => group.id);
  
  //get group grades
  const groupGrades = await Grade.findAll({
    where: { 
      groupId: { [Op.in]: groupIds },
      studentId: null // Grades for all the group members
    },
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: EvaluationCriteria,
        as: 'criteria'
      },
      {
        model: Group,
        as: 'group'
      }
    ]
  });
  
  const projectGradesMap = new Map();
  
  [...individualGrades, ...groupGrades].forEach(grade => {
    const projectId = grade.project.id;
    
    if (!projectGradesMap.has(projectId)) {
      projectGradesMap.set(projectId, {
        project: grade.project,
        grades: []
      });
    }
    
    projectGradesMap.get(projectId).grades.push(grade);
  });
  
  return Array.from(projectGradesMap.values());
};

module.exports = {
  createUser,
  importUsers,
  parseImportFile,
  getUserById,
  getAllUsers,
  getUserProjects,
  updateUser,
  deactivateUser,
  activateUser,
  changePassword,
  resetUserPassword,
  getStudentGrades
};
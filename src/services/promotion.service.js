const { Promotion, User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const userService = require('./user.service');
const emailService = require('./email.service');
const { Op } = require('sequelize');

const createPromotion = async (promotionData) => {

  const existingPromotion = await Promotion.findOne({
    where: { name: promotionData.name }
  });

  if (existingPromotion) {
    throw new AppError('Promotion with this name already exists', 400);
  }
  const promotion = await Promotion.create(promotionData);

  return promotion;
};

const getPromotionById = async (id) => {
  const promotion = await Promotion.findByPk(id, {
    include: [
      {
        model: User,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'email', 'isActive']
      }
    ]
  });

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  return promotion;
};

const getAllPromotions = async (filters = {}) => {
  const { year, search, page = 1, limit = 10 } = filters;

  const whereClause = {};

  if (year) {
    whereClause.year = year;
  }

  if (search) {
    whereClause.name = { [Op.iLike]: `%${search}%` };
  }

  const { count, rows } = await Promotion.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        separate: true
      }
    ],
    distinct: true,
    offset: (page - 1) * limit,
    limit,
    order: [['year', 'DESC'], ['name', 'ASC']]
  });

  return {
    promotions: rows,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page)
  };
};

const updatePromotion = async (id, updateData) => {
  const promotion = await Promotion.findByPk(id);

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  if (updateData.name && updateData.name !== promotion.name) {
    const existingPromotion = await Promotion.findOne({
      where: { name: updateData.name }
    });

    if (existingPromotion) {
      throw new AppError('Promotion name already in use', 400);
    }
  }

  await promotion.update(updateData);

  return promotion;
};

const deletePromotion = async (id) => {
  const promotion = await Promotion.findByPk(id, {
    include: [{ model: User, as: 'students' }]
  });

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  if (promotion.students && promotion.students.length > 0) {
    throw new AppError('Cannot delete promotion with associated students', 400);
  }

  await promotion.destroy();

  return { success: true, message: 'Promotion deleted successfully' };
};

const addStudentToPromotion = async (promotionId, userData) => {
  const promotion = await Promotion.findByPk(promotionId);

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  userData.role = 'student';
  userData.promotionId = promotionId;

  const student = await userService.createUser(userData);

  return student;
};

const addStudentsToPromotionFromFile = async (promotionId, parsedStudents) => {
  const promotion = await Promotion.findByPk(promotionId);

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  const result = await userService.importUsers(parsedStudents, promotionId);

  return result;
};

const removeStudentFromPromotion = async (promotionId, studentId) => {
  const promotion = await Promotion.findByPk(promotionId);

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  const student = await User.findByPk(studentId);

  if (!student) {
    throw new AppError('Student not found', 404);
  }

  if (student.promotionId !== promotionId) {
    throw new AppError('Student is not in this promotion', 400);
  }

  student.promotionId = null;
  await student.save();

  return { success: true, message: 'Student removed from promotion successfully' };
};

const getPromotionStudents = async (promotionId, filters = {}) => {
  const { search, page = 1, limit = 10, isActive } = filters;

  const promotion = await Promotion.findByPk(promotionId);

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  const whereClause = {
    promotionId,
    role: 'student'
  };

  if (isActive !== undefined) {
    whereClause.isActive = isActive;
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
    offset: (page - 1) * limit,
    limit,
    order: [['lastName', 'ASC'], ['firstName', 'ASC']]
  });

  return {
    students: rows,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page)
  };
};

module.exports = {
  createPromotion,
  getPromotionById,
  getAllPromotions,
  updatePromotion,
  deletePromotion,
  addStudentToPromotion,
  addStudentsToPromotionFromFile,
  removeStudentFromPromotion,
  getPromotionStudents
};
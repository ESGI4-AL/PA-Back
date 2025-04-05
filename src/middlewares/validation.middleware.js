const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./error.middleware');

//for errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: errorMessages
    });
  }
  next();
};

//for users
const userValidationRules = {
  create: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('firstName')
      .notEmpty()
      .withMessage('First name is required'),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required'),
    body('role')
      .isIn(['teacher', 'student'])
      .withMessage('Role must be either teacher or student'),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ],
  update: [
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('firstName')
      .optional()
      .notEmpty()
      .withMessage('First name cannot be empty'),
    body('lastName')
      .optional()
      .notEmpty()
      .withMessage('Last name cannot be empty'),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ],
  login: [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]
};

//for promotion
const promotionValidationRules = {
  create: [
    body('name')
      .notEmpty()
      .withMessage('Name is required'),
    body('year')
      .isInt({ min: 2000 })
      .withMessage('Year must be a valid year')
  ],
  update: [
    body('name')
      .optional()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('year')
      .optional()
      .isInt({ min: 2000 })
      .withMessage('Year must be a valid year')
  ]
};

//for project
const projectValidationRules = {
  create: [
    body('name')
      .notEmpty()
      .withMessage('Name is required'),
    body('promotionId')
      .notEmpty()
      .withMessage('Promotion ID is required'),
    body('status')
      .optional()
      .isIn(['draft', 'visible'])
      .withMessage('Status must be either draft or visible'),
    body('minGroupSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Minimum group size must be at least 1'),
    body('maxGroupSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Maximum group size must be at least 1'),
    body('groupFormationMethod')
      .optional()
      .isIn(['manual', 'random', 'free'])
      .withMessage('Group formation method must be manual, random, or free')
  ],
  update: [
    body('name')
      .optional()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('status')
      .optional()
      .isIn(['draft', 'visible'])
      .withMessage('Status must be either draft or visible'),
    body('minGroupSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Minimum group size must be at least 1'),
    body('maxGroupSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Maximum group size must be at least 1'),
    body('groupFormationMethod')
      .optional()
      .isIn(['manual', 'random', 'free'])
      .withMessage('Group formation method must be manual, random, or free')
  ]
};

module.exports = {
  validate,
  userValidationRules,
  promotionValidationRules,
  projectValidationRules
};
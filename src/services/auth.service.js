const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const login = async (email, password) => {

  const user = await User.findOne({ where: { email } });
  
  if (!user || !(await user.isValidPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  
  if (!user.isActive) {
    throw new AppError('Account is inactive', 403);
  }
  

  const token = generateToken(user);
  
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  };
};


const oauthLogin = async (provider, providerId, email, firstName, lastName) => {

  const providerField = provider === 'google' ? 'googleId' : 'microsoftId';
  
  const whereClause = {};
  whereClause[Op.or] = [
    { email },
    {}
  ];
  whereClause[Op.or][1][providerField] = providerId;
  
  const user = await User.findOne({ where: whereClause });
  
  if (!user) {
    throw new AppError('No account found with this email. Please contact your teacher for account creation.', 404);
  }
  
  if (!user[providerField]) {
    user[providerField] = providerId;
    await user.save();
  }
  
  if (!user.isActive) {
    throw new AppError('Account is inactive', 403);
  }
  
  const token = generateToken(user);
  
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  };
};

const googleLogin = (googleId, email, firstName, lastName) => {
  return oauthLogin('google', googleId, email, firstName, lastName);
};

const microsoftLogin = (microsoftId, email, firstName, lastName) => {
  return oauthLogin('microsoft', microsoftId, email, firstName, lastName);
};


const registerTeacher = async (email, password, firstName, lastName) => {

  const existingUser = await User.findOne({ where: { email } });
  
  if (existingUser) {
    throw new AppError('Email already in use', 400);
  }
  
  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    role: 'teacher',
    isActive: true
  });
  
  await emailService.sendWelcomeEmail(user);
  
  const token = generateToken(user);
  
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  };
};

module.exports = {
  login,
  googleLogin,
  microsoftLogin,
  registerTeacher,
  generateToken
};
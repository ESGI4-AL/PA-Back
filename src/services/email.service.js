const nodemailer = require('nodemailer');
const { AppError } = require('../middlewares/error.middleware');

let transporter;

const initTransporter = () => {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

const verifyTransporter = async () => {
  if (!transporter) {
    initTransporter();
  }
  
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email transporter verification failed:', error);
    return false;
  }
};

const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    initTransporter();
  }
  
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    };
    
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new AppError('Failed to send email', 500);
  }
};

const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Student Project Manager';
  const html = `
    <h1>Welcome, ${user.firstName}!</h1>
    <p>Your account has been created successfully on the Student Project Manager platform.</p>
    <p>Here are your login details:</p>
    <ul>
      <li>Email: ${user.email}</li>
      <li>Role: ${user.role}</li>
    </ul>
    <p>You can log in at: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a></p>
    <p>Thank you for joining us!</p>
  `;
  
  return sendEmail(user.email, subject, html);
};

const sendNewProjectNotification = async (user, project) => {
  const subject = 'New Project Available';
  const html = `
    <h1>Hello, ${user.firstName}!</h1>
    <p>A new project has been made available to your promotion:</p>
    <h2>${project.name}</h2>
    <p>${project.description || ''}</p>
    <p>You can view the project details at: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${project.id}">${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${project.id}</a></p>
  `;
  
  return sendEmail(user.email, subject, html);
};

initTransporter();

module.exports = {
  verifyTransporter,
  sendEmail,
  sendWelcomeEmail,
  sendNewProjectNotification
};
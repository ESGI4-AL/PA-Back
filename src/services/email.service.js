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

const sendWelcomeEmailWithPassword = async (user, temporaryPassword) => {
  console.log('Preparing welcome email with password for student:', user.email);
  console.log('Temporary password received:', temporaryPassword);
     
  if (!temporaryPassword) {
    console.error('No temporary password provided!');
    throw new AppError('Temporary password is required', 400);
  }
     
  const subject = 'Bienvenue sur Kōdō - Vos identifiants de connexion';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenue sur Kōdō</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); min-height: 100vh;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
        
        <!-- Header avec dégradé Kōdō -->
        <div style="background: linear-gradient(135deg, #ff6b6b, #ff8e8e); padding: 40px 30px; text-align: center; position: relative;">
          <div style="background: white; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
            <div style="font-size: 40px;">🥷</div>
          </div>
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Bienvenue sur Kōdō
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">
            Gestionnaire de projets étudiants
          </p>
        </div>

        <!-- Contenu principal -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">
            Bonjour ${user.firstName} ! 👋
          </h2>
          
          <p style="color: #666; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
            Votre compte étudiant a été créé avec succès sur la plateforme Kōdō. 
            Vous pouvez maintenant accéder à vos projets et collaborer avec vos équipes.
          </p>

          <!-- Carte des identifiants -->
          <div style="background: linear-gradient(135deg, #f8f9fa, #ffffff); border: 2px solid #ff6b6b; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #ff6b6b; margin: 0 0 20px 0; font-size: 20px; display: flex; align-items: center;">
              🔐 Vos identifiants de connexion
            </h3>
            
            <div style="margin: 15px 0;">
              <strong style="color: #333; display: inline-block; width: 80px;">Email:</strong>
              <span style="color: #666; font-family: 'Courier New', monospace;">${user.email}</span>
            </div>
            
            <div style="margin: 15px 0;">
              <strong style="color: #333; display: inline-block; width: 80px;">Mot de passe:</strong>
              <span style="background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; padding: 8px 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; letter-spacing: 1px; box-shadow: 0 2px 8px rgba(255,107,107,0.3);">
                ${temporaryPassword}
              </span>
            </div>
            
            <div style="margin: 15px 0;">
              <strong style="color: #333; display: inline-block; width: 80px;">Rôle:</strong>
              <span style="background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
                ${user.role === 'student' ? 'Étudiant' : user.role}
              </span>
            </div>
          </div>

          <!-- Alerte de sécurité -->
          <div style="background: linear-gradient(135deg, #fff3cd, #ffeaa7); border-left: 4px solid #ff6b6b; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; color: #856404; font-weight: 500; display: flex; align-items: center;">
              <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
              <strong>Important:</strong> Veuillez changer votre mot de passe lors de votre première connexion pour des raisons de sécurité.
            </p>
          </div>

          <!-- Bouton de connexion -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
               style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 16px rgba(255,107,107,0.4); transition: all 0.3s ease; text-align: center; min-width: 200px;">
              🚀 Se connecter à Kōdō
            </a>
          </div>

          <!-- Section d'aide -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">
              Besoin d'aide ?
            </h4>
            <p style="color: #666; margin: 0; font-size: 14px; line-height: 1.5;">
              Si vous avez des questions ou rencontrez des difficultés, n'hésitez pas à contacter votre administrateur ou consultez notre section Support.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
          <div style="margin-bottom: 15px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 20px;">🥷</span>
            </div>
          </div>
          <p style="color: #999; margin: 0; font-size: 14px;">
            © 2025 Kōdō - Gestionnaire de projets étudiants
          </p>
          <p style="color: #ccc; margin: 5px 0 0 0; font-size: 12px;">
            Tous droits réservés
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
     
  return sendEmail(user.email, subject, html);
};

initTransporter();

module.exports = {
  verifyTransporter,
  sendEmail,
  sendWelcomeEmail,
  sendNewProjectNotification,
  sendWelcomeEmailWithPassword
};
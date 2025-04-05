const User = require('./user.model');
const Promotion = require('./promotion.model');
const Project = require('./project.model');
const Group = require('./group.model');
const Deliverable = require('./deliverable.model');
const Submission = require('./submission.model');
const Report = require('./report.model');
const ReportSection = require('./reportSection.model');
const PresentationSchedule = require('./presentationSchedule.model');
const EvaluationCriteria = require('./evaluationCriteria.model');
const Grade = require('./grade.model');
const Notification = require('./notification.model');
const DeliverableRule = require('./deliverableRule.model');

// Relation Promotion - User (Students)
Promotion.hasMany(User, { foreignKey: 'promotionId', as: 'students' });
User.belongsTo(Promotion, { foreignKey: 'promotionId', as: 'promotion' });

// Relation Project - Teacher
Project.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
User.hasMany(Project, { foreignKey: 'teacherId', as: 'projects' });

// Relation Project - Promotion
Project.belongsTo(Promotion, { foreignKey: 'promotionId', as: 'promotion' });
Promotion.hasMany(Project, { foreignKey: 'promotionId', as: 'projects' });

// Relation Project - Group
Project.hasMany(Group, { foreignKey: 'projectId', as: 'groups' });
Group.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Relation Group - User (Students)
Group.belongsToMany(User, { through: 'GroupMembers', as: 'members' });
User.belongsToMany(Group, { through: 'GroupMembers', as: 'groups' });

// Relation Project - Deliverable
Project.hasMany(Deliverable, { foreignKey: 'projectId', as: 'deliverables' });
Deliverable.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Relation Group - Submission
Group.hasMany(Submission, { foreignKey: 'groupId', as: 'submissions' });
Submission.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

// Relation Deliverable - Submission
Deliverable.hasMany(Submission, { foreignKey: 'deliverableId', as: 'submissions' });
Submission.belongsTo(Deliverable, { foreignKey: 'deliverableId', as: 'deliverable' });

// Relation Project - Report
Project.hasMany(Report, { foreignKey: 'projectId', as: 'reports' });
Report.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Relation Report - ReportSection
Report.hasMany(ReportSection, { foreignKey: 'reportId', as: 'sections' });
ReportSection.belongsTo(Report, { foreignKey: 'reportId', as: 'report' });

// Relation Group - Report
Group.hasMany(Report, { foreignKey: 'groupId', as: 'reports' });
Report.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

// Relation Project - PresentationSchedule
Project.hasMany(PresentationSchedule, { foreignKey: 'projectId', as: 'presentationSchedules' });
PresentationSchedule.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Relation Group - PresentationSchedule
Group.hasOne(PresentationSchedule, { foreignKey: 'groupId', as: 'presentationSchedule' });
PresentationSchedule.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

// Relation Project - EvaluationCriteria
Project.hasMany(EvaluationCriteria, { foreignKey: 'projectId', as: 'evaluationCriteria' });
EvaluationCriteria.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Relations pour les grades (selon le type d'évaluation)
EvaluationCriteria.hasMany(Grade, { foreignKey: 'criteriaId', as: 'grades' });
Grade.belongsTo(EvaluationCriteria, { foreignKey: 'criteriaId', as: 'criteria' });

Group.hasMany(Grade, { foreignKey: 'groupId', as: 'groupGrades' });
Grade.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

User.hasMany(Grade, { foreignKey: 'studentId', as: 'studentGrades' });
Grade.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

Deliverable.hasMany(Grade, { foreignKey: 'deliverableId', as: 'deliverableGrades' });
Grade.belongsTo(Deliverable, { foreignKey: 'deliverableId', as: 'deliverable' });

Report.hasMany(Grade, { foreignKey: 'reportId', as: 'reportGrades' });
Grade.belongsTo(Report, { foreignKey: 'reportId', as: 'report' });

PresentationSchedule.hasMany(Grade, { foreignKey: 'presentationId', as: 'presentationGrades' });
Grade.belongsTo(PresentationSchedule, { foreignKey: 'presentationId', as: 'presentation' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Deliverable.hasMany(DeliverableRule, { foreignKey: 'deliverableId', as: 'rules' });
DeliverableRule.belongsTo(Deliverable, { foreignKey: 'deliverableId', as: 'deliverable' });


module.exports = {
  User,
  Promotion,
  Project,
  Group,
  Deliverable,
  Submission,
  Report,
  ReportSection,
  PresentationSchedule,
  EvaluationCriteria,
  Grade,
  Notification,
  DeliverableRule
};
const { Report, ReportSection, Project, Group, User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');

const createReport = async (projectId, groupId, reportData) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  const group = await Group.findByPk(groupId);
  
  if (!group) {
    throw new AppError('Group not found', 404);
  }
  
  if (group.projectId !== projectId) {
    throw new AppError('Group is not part of this project', 400);
  }
  
  const existingReport = await Report.findOne({
    where: {
      projectId,
      groupId
    }
  });
  
  if (existingReport) {
    throw new AppError('A report already exists for this group and project', 400);
  }
  
  const report = await Report.create({
    title: reportData.title,
    description: reportData.description || null,
    projectId,
    groupId
  });
  
  if (reportData.sections && Array.isArray(reportData.sections)) {
    const sections = [];
    
    for (let i = 0; i < reportData.sections.length; i++) {
      const sectionData = reportData.sections[i];
      
      const section = await ReportSection.create({
        title: sectionData.title,
        content: sectionData.content || '',
        order: i,
        reportId: report.id
      });
      
      sections.push(section);
    }
    
    report.sections = sections;
  }
  
  return report;
};

const getReportById = async (reportId) => {
  const report = await Report.findByPk(reportId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      },
      {
        model: ReportSection,
        as: 'sections',
        order: [['order', 'ASC']]
      }
    ]
  });
  
  if (!report) {
    throw new AppError('Report not found', 404);
  }
  
  return report;
};

const getGroupReport = async (projectId, groupId) => {
  const report = await Report.findOne({
    where: {
      projectId,
      groupId
    },
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      },
      {
        model: ReportSection,
        as: 'sections',
        order: [['order', 'ASC']]
      }
    ]
  });
  
  if (!report) {
    throw new AppError('Report not found for this group and project', 404);
  }
  
  return report;
};

const updateReport = async (reportId, updateData, userId) => {
  const report = await Report.findByPk(reportId, {
    include: [
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members'
          }
        ]
      },
      {
        model: Project,
        as: 'project'
      }
    ]
  });
  
  if (!report) {
    throw new AppError('Report not found', 404);
  }
  
  const isTeacher = report.project.teacherId === userId;
  const isMember = report.group.members.some(member => member.id === userId);
  
  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to update this report', 403);
  }
  
  if (updateData.title || updateData.description !== undefined) {
    await report.update({
      title: updateData.title || report.title,
      description: updateData.description !== undefined ? updateData.description : report.description
    });
  }
  
  return report;
};

const addReportSection = async (reportId, sectionData, userId) => {
  const report = await Report.findByPk(reportId, {
    include: [
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members'
          }
        ]
      },
      {
        model: Project,
        as: 'project'
      },
      {
        model: ReportSection,
        as: 'sections',
        order: [['order', 'ASC']]
      }
    ]
  });
  
  if (!report) {
    throw new AppError('Report not found', 404);
  }
  
  const isTeacher = report.project.teacherId === userId;
  const isMember = report.group.members.some(member => member.id === userId);
  
  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to add sections to this report', 403);
  }
  
  const order = report.sections.length;
  
  const section = await ReportSection.create({
    title: sectionData.title,
    content: sectionData.content || '',
    order,
    reportId
  });
  
  return section;
};

const updateReportSection = async (sectionId, updateData, userId) => {
  const section = await ReportSection.findByPk(sectionId, {
    include: [
      {
        model: Report,
        as: 'report',
        include: [
          {
            model: Group,
            as: 'group',
            include: [
              {
                model: User,
                as: 'members'
              }
            ]
          },
          {
            model: Project,
            as: 'project'
          }
        ]
      }
    ]
  });
  
  if (!section) {
    throw new AppError('Report section not found', 404);
  }
  
  const isTeacher = section.report.project.teacherId === userId;
  const isMember = section.report.group.members.some(member => member.id === userId);
  
  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to update this section', 403);
  }
  
  await section.update({
    title: updateData.title !== undefined ? updateData.title : section.title,
    content: updateData.content !== undefined ? updateData.content : section.content
  });
  
  return section;
};

const deleteReportSection = async (sectionId, userId) => {
  const section = await ReportSection.findByPk(sectionId, {
    include: [
      {
        model: Report,
        as: 'report',
        include: [
          {
            model: Group,
            as: 'group',
            include: [
              {
                model: User,
                as: 'members'
              }
            ]
          },
          {
            model: Project,
            as: 'project'
          },
          {
            model: ReportSection,
            as: 'sections',
            order: [['order', 'ASC']]
          }
        ]
      }
    ]
  });
  
  if (!section) {
    throw new AppError('Report section not found', 404);
  }
  
  const isTeacher = section.report.project.teacherId === userId;
  const isMember = section.report.group.members.some(member => member.id === userId);
  
  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to delete this section', 403);
  }
  
  const sectionOrder = section.order;
  const reportId = section.report.id;
  
  await section.destroy();
  
  const remainingSections = section.report.sections.filter(s => s.id !== sectionId);
  
  for (const s of remainingSections) {
    if (s.order > sectionOrder) {
      await s.update({ order: s.order - 1 });
    }
  }
  
  return { success: true, message: 'Section deleted successfully' };
};

const reorderReportSections = async (reportId, sectionOrder, userId) => {
  const report = await Report.findByPk(reportId, {
    include: [
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members'
          }
        ]
      },
      {
        model: Project,
        as: 'project'
      },
      {
        model: ReportSection,
        as: 'sections'
      }
    ]
  });
  
  if (!report) {
    throw new AppError('Report not found', 404);
  }
  
  const isTeacher = report.project.teacherId === userId;
  const isMember = report.group.members.some(member => member.id === userId);
  
  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to reorder this report', 403);
  }
  
  if (sectionOrder.length !== report.sections.length) {
    throw new AppError('The specified order must contain all sections', 400);
  }
  
  const sectionIds = new Set(report.sections.map(s => s.id));
  for (const id of sectionOrder) {
    if (!sectionIds.has(id)) {
      throw new AppError(`Section with ID ${id} does not belong to this report`, 400);
    }
  }
  
  for (let i = 0; i < sectionOrder.length; i++) {
    const section = report.sections.find(s => s.id === sectionOrder[i]);
    await section.update({ order: i });
  }
  
  const updatedReport = await Report.findByPk(reportId, {
    include: [
      {
        model: ReportSection,
        as: 'sections',
        order: [['order', 'ASC']]
      }
    ]
  });
  
  return updatedReport;
};

const getProjectReports = async (projectId, teacherId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to view these reports', 403);
  }
  
  const reports = await Report.findAll({
    where: { projectId },
    include: [
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      },
      {
        model: ReportSection,
        as: 'sections',
        order: [['order', 'ASC']]
      }
    ],
    order: [
      [{ model: Group, as: 'group' }, 'name', 'ASC']
    ]
  });
  
  return reports;
};

module.exports = {
  createReport,
  getReportById,
  getGroupReport,
  updateReport,
  addReportSection,
  updateReportSection,
  deleteReportSection,
  reorderReportSections,
  getProjectReports
};
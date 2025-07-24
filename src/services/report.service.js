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
        contentType: sectionData.contentType || 'html', // Support WYSIWYG
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

const getReportSections = async (reportId, sectionIds = null, userId) => {

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
            as: 'members'
          }
        ]
      }
    ]
  });

  if (!report) {
    throw new AppError('Report not found', 404);
  }

  const isTeacher = report.project.teacherId === userId;
  const isMember = report.group.members.some(member => member.id === userId);

  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to view this report', 403);
  }

  const whereClause = { reportId };
  if (sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) {
    whereClause.id = sectionIds;
  }

  const sections = await ReportSection.findAll({
    where: whereClause,
    order: [['order', 'ASC']]
  });

  return {
    report: {
      id: report.id,
      title: report.title,
      description: report.description,
      project: report.project,
      group: report.group
    },
    sections,
    totalSections: await ReportSection.count({ where: { reportId } })
  };
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

  if (report.status !== 'draft' && (updateData.title || updateData.description || updateData.status)) {
    if (updateData.title || updateData.description) {
      throw new AppError('Cannot modify content of a submitted report', 400);
    }
  }

  const updateFields = {};

  if (updateData.title !== undefined) {
    updateFields.title = updateData.title;
  }

  if (updateData.description !== undefined) {
    updateFields.description = updateData.description;
  }

  if (updateData.status !== undefined) {
    const validStatuses = ['draft', 'submitted', 'reviewed', 'published'];
    if (!validStatuses.includes(updateData.status)) {
      throw new AppError('Invalid status. Must be draft, submitted, reviewed, or published', 400);
    }
    updateFields.status = updateData.status;
  }

  if (updateData.submittedAt !== undefined) {
    updateFields.submittedAt = updateData.submittedAt;
  }

  if (updateData.reviewedAt !== undefined) {
    updateFields.reviewedAt = updateData.reviewedAt;
  }

  if (updateData.title || updateData.description || updateData.status) {
    updateFields.lastEditedBy = userId;
  }

  await report.update(updateFields);

  const updatedReport = await Report.findByPk(reportId, {
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

  return updatedReport;
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

  if (report.status !== 'draft') {
    throw new AppError('Cannot add sections to a submitted report', 400);
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
    contentType: sectionData.contentType || 'html',
    sectionType: sectionData.sectionType || 'text',
    order,
    reportId,
    lastEditedBy: userId
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

  if (section.report.status !== 'draft') {
    throw new AppError('Cannot modify sections of a submitted report', 400);
  }

  const isTeacher = section.report.project.teacherId === userId;
  const isMember = section.report.group.members.some(member => member.id === userId);

  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to update this section', 403);
  }

  const updateFields = {};

  if (updateData.title !== undefined) {
    updateFields.title = updateData.title;
  }

  if (updateData.content !== undefined) {
    updateFields.content = updateData.content;
  }

  if (updateData.contentType !== undefined) {
    const validTypes = ['html', 'markdown', 'plain'];
    if (!validTypes.includes(updateData.contentType)) {
      throw new AppError('Invalid content type. Must be html, markdown, or plain', 400);
    }
    updateFields.contentType = updateData.contentType;
  }

  if (updateData.sectionType !== undefined) {
    const validSectionTypes = ['text', 'image', 'table', 'code', 'mixed'];
    if (!validSectionTypes.includes(updateData.sectionType)) {
      throw new AppError('Invalid section type. Must be text, image, table, code, or mixed', 400);
    }
    updateFields.sectionType = updateData.sectionType;
  }

  updateFields.lastEditedBy = userId;

  await section.update(updateFields);

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

  if (section.report.status !== 'draft') {
    throw new AppError('Cannot delete sections from a submitted report', 400);
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

const getReportNavigation = async (projectId, currentReportId, userId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const currentReport = await Report.findByPk(currentReportId, {
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
      }
    ]
  });

  if (!currentReport) {
    throw new AppError('Current report not found', 404);
  }

  const isTeacher = project.teacherId === userId;
  const isMember = currentReport.group.members.some(member => member.id === userId);

  if (!isTeacher && !isMember) {
    throw new AppError('You are not authorized to navigate these reports', 403);
  }

  const allReports = await Report.findAll({
    where: { projectId },
    include: [
      {
        model: Group,
        as: 'group',
        attributes: ['id', 'name']
      }
    ],
    order: [
      [{ model: Group, as: 'group' }, 'name', 'ASC']
    ]
  });

  const currentIndex = allReports.findIndex(report => report.id === currentReportId);

  if (currentIndex === -1) {
    throw new AppError('Current report not found in project', 404);
  }

  const navigation = {
    current: {
      index: currentIndex + 1,
      total: allReports.length,
      report: allReports[currentIndex]
    },
    previous: currentIndex > 0 ? allReports[currentIndex - 1] : null,
    next: currentIndex < allReports.length - 1 ? allReports[currentIndex + 1] : null,
    all: allReports.map((report, index) => ({
      id: report.id,
      title: report.title,
      groupName: report.group.name,
      index: index + 1,
      isCurrent: report.id === currentReportId
    }))
  };

  return navigation;
};

const getNextReport = async (currentReportId, projectId, userId) => {
  const navigation = await getReportNavigation(projectId, currentReportId, userId);

  if (!navigation.next) {
    throw new AppError('No next report available', 404);
  }

  return getReportById(navigation.next.id);
};

const getPreviousReport = async (currentReportId, projectId, userId) => {
  const navigation = await getReportNavigation(projectId, currentReportId, userId);

  if (!navigation.previous) {
    throw new AppError('No previous report available', 404);
  }

  return getReportById(navigation.previous.id);
};

const getReportPreview = async (reportId, options = {}) => {
  const {
    sectionsOnly = false,
    sectionIds = null,
    includeMetadata = true
  } = options;

  const includeOptions = [];

  if (!sectionsOnly) {
    includeOptions.push(
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
      }
    );
  }

  // Configuration pour les sections
  const sectionInclude = {
    model: ReportSection,
    as: 'sections',
    order: [['order', 'ASC']]
  };

  if (sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) {
    sectionInclude.where = { id: sectionIds };
  }

  includeOptions.push(sectionInclude);

  const report = await Report.findByPk(reportId, {
    include: includeOptions
  });

  if (!report) {
    throw new AppError('Report not found', 404);
  }

  const result = {
    id: report.id,
    title: report.title,
    description: report.description,
    sections: report.sections
  };

  if (includeMetadata && !sectionsOnly) {
    result.project = report.project;
    result.group = report.group;
    result.createdAt = report.createdAt;
    result.updatedAt = report.updatedAt;
  }

  return result;
};

module.exports = {
  createReport,
  getReportById,
  getReportSections,
  getGroupReport,
  updateReport,
  addReportSection,
  updateReportSection,
  deleteReportSection,
  reorderReportSections,
  getProjectReports,
  getReportNavigation,
  getNextReport,
  getPreviousReport,
  getReportPreview
};
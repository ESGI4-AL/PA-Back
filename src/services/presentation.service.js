const { Op } = require('sequelize');
const { PresentationSchedule, Group, Project, User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const createPresentationSchedule = async (projectId, scheduleData, teacherId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: Group,
        as: 'groups'
      }
    ]
  });
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to create a schedule for this project', 403);
  }
  
  if (project.groups.length === 0) {
    throw new AppError('No groups found for this project', 400);
  }
  
  if (scheduleData.startTime && !scheduleData.duration && !scheduleData.endTime) {
    throw new AppError('Either duration or end time must be provided', 400);
  }
  
  const startTime = new Date(scheduleData.startTime);
  let endTime = null;
  let duration = null;
  
  if (scheduleData.endTime) {
    endTime = new Date(scheduleData.endTime);
    
    if (endTime <= startTime) {
      throw new AppError('End time must be after start time', 400);
    }
    
    const totalDuration = (endTime - startTime) / (60 * 1000);
    duration = Math.floor(totalDuration / project.groups.length);
  } else if (scheduleData.duration) {
    duration = scheduleData.duration;
    const totalMinutes = duration * project.groups.length;
    endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
  }
  
  await PresentationSchedule.destroy({
    where: { projectId }
  });
  
  const schedules = [];
  let currentTime = new Date(startTime);
  
  for (let i = 0; i < project.groups.length; i++) {
    const group = project.groups[i];
    
    const schedule = await PresentationSchedule.create({
      startTime: currentTime,
      endTime: new Date(currentTime.getTime() + duration * 60 * 1000),
      duration,
      order: i + 1,
      projectId,
      groupId: group.id
    });
    
    schedules.push(schedule);
    
    currentTime = new Date(currentTime.getTime() + duration * 60 * 1000);
  }
  
  return {
    projectId,
    startTime,
    endTime,
    duration,
    groupCount: project.groups.length,
    schedules
  };
};

const reorderPresentationSchedule = async (projectId, groupOrder, teacherId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: PresentationSchedule,
        as: 'presentationSchedules',
        include: [
          {
            model: Group,
            as: 'group'
          }
        ]
      }
    ]
  });
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to reorder schedules for this project', 403);
  }
  
  if (groupOrder.length !== project.presentationSchedules.length) {
    throw new AppError('The specified order must contain all groups', 400);
  }
  
  const scheduleByGroupId = {};
  project.presentationSchedules.forEach(schedule => {
    scheduleByGroupId[schedule.groupId] = schedule;
  });
  
  for (const groupId of groupOrder) {
    if (!scheduleByGroupId[groupId]) {
      throw new AppError(`Group with ID ${groupId} does not have a schedule`, 400);
    }
  }
  
  const firstSchedule = project.presentationSchedules[0];
  if (!firstSchedule) {
    throw new AppError('No schedules found for this project', 400);
  }
  
  const duration = firstSchedule.duration;
  let currentTime = new Date(firstSchedule.startTime);
  
  for (let i = 0; i < groupOrder.length; i++) {
    const groupId = groupOrder[i];
    const schedule = scheduleByGroupId[groupId];
    
    await schedule.update({
      order: i + 1,
      startTime: currentTime,
      endTime: new Date(currentTime.getTime() + duration * 60 * 1000)
    });
    
    currentTime = new Date(currentTime.getTime() + duration * 60 * 1000);
  }
  
  const updatedSchedules = await PresentationSchedule.findAll({
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
      }
    ],
    order: [['order', 'ASC']]
  });
  
  return updatedSchedules;
};

const getProjectPresentationSchedule = async (projectId) => {
  const schedules = await PresentationSchedule.findAll({
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
      }
    ],
    order: [['order', 'ASC']]
  });
  
  if (schedules.length === 0) {
    throw new AppError('No presentation schedule found for this project', 404);
  }
  
  return schedules;
};

const generateSchedulePDF = async (projectId, teacherId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: PresentationSchedule,
        as: 'presentationSchedules',
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
          }
        ]
      }
    ]
  });
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to generate PDFs for this project', 403);
  }
  
  if (project.presentationSchedules.length === 0) {
    throw new AppError('No presentation schedule found for this project', 404);
  }
  
  const schedules = project.presentationSchedules.sort((a, b) => a.order - b.order);
  
  const doc = new PDFDocument();
  const fileName = `presentation_schedule_${projectId}_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '../../uploads', fileName);
  const writeStream = fs.createWriteStream(filePath);
  
  doc.pipe(writeStream);
  
  doc.fontSize(20).text(`Presentation Schedule - ${project.name}`, { align: 'center' });
  doc.moveDown();
  
  const startDate = new Date(schedules[0].startTime);
  doc.fontSize(14).text(`Date: ${startDate.toLocaleDateString()}`, { align: 'center' });
  doc.moveDown();
  
  doc.fontSize(16).text('Presentation Schedule:', { underline: true });
  doc.moveDown();
  
  schedules.forEach(schedule => {
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    const groupName = schedule.group.name;
    
    doc.fontSize(14).text(`${groupName}`, { continued: true })
       .fontSize(12).text(` (Order: ${schedule.order})`, { align: 'left' });
    
    doc.fontSize(12).text(`Time: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`, { align: 'left' });
    
    doc.fontSize(10).text('Members:', { align: 'left' });
    schedule.group.members.forEach(member => {
      doc.text(`- ${member.firstName} ${member.lastName} (${member.email})`, { align: 'left' });
    });
    
    doc.moveDown();
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      resolve({
        filePath: `uploads/${fileName}`,
        fileName
      });
    });
    
    writeStream.on('error', reject);
  });
};

const generateAttendanceSheetPDF = async (projectId, teacherId, sortBy = 'group') => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: PresentationSchedule,
        as: 'presentationSchedules',
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
          }
        ]
      }
    ]
  });
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to generate PDFs for this project', 403);
  }
  
  if (project.presentationSchedules.length === 0) {
    throw new AppError('No presentation schedule found for this project', 404);
  }
  const doc = new PDFDocument();
  const fileName = `attendance_sheet_${projectId}_${sortBy}_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '../../uploads', fileName);
  const writeStream = fs.createWriteStream(filePath);
  
  doc.pipe(writeStream);
  
  doc.fontSize(20).text(`Attendance Sheet - ${project.name}`, { align: 'center' });
  doc.moveDown();
  
  const startDate = new Date(project.presentationSchedules[0].startTime);
  doc.fontSize(14).text(`Date: ${startDate.toLocaleDateString()}`, { align: 'center' });
  doc.moveDown();
  
  if (sortBy === 'group') {
    doc.fontSize(16).text('Attendance by Group:', { underline: true });
    doc.moveDown();
    
    const schedules = project.presentationSchedules.sort((a, b) => a.order - b.order);
    
    schedules.forEach(schedule => {
      const groupName = schedule.group.name;
      const startTime = new Date(schedule.startTime);
      
      doc.fontSize(14).text(`${groupName} - ${startTime.toLocaleTimeString()}`, { align: 'left' });
      doc.moveDown(0.5);
      
      const members = schedule.group.members.sort((a, b) => 
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );
      
      members.forEach(member => {
        doc.fontSize(12)
           .text(`${member.lastName} ${member.firstName}`, { continued: true, width: 300 })
           .text(`Signature: ______________________`, { align: 'right' });
      });
      
      doc.moveDown();
    });
  } else if (sortBy === 'alphabetical') {
    doc.fontSize(16).text('Attendance by Student (Alphabetical):', { underline: true });
    doc.moveDown();
    
    const allStudents = [];
    project.presentationSchedules.forEach(schedule => {
      schedule.group.members.forEach(member => {
        allStudents.push({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          groupName: schedule.group.name,
          startTime: schedule.startTime
        });
      });
    });
    
    allStudents.sort((a, b) => 
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );
    
    allStudents.forEach(student => {
      const startTime = new Date(student.startTime);
      
      doc.fontSize(12)
         .text(`${student.lastName} ${student.firstName} (${student.groupName} - ${startTime.toLocaleTimeString()})`, { continued: true, width: 350 })
         .text(`Signature: ______________________`, { align: 'right' });
    });
  }
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      resolve({
        filePath: `uploads/${fileName}`,
        fileName
      });
    });
    
    writeStream.on('error', reject);
  });
};

module.exports = {
  createPresentationSchedule,
  reorderPresentationSchedule,
  getProjectPresentationSchedule,
  generateSchedulePDF,
  generateAttendanceSheetPDF
};
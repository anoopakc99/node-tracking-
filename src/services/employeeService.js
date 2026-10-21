const prisma = require('../config/database');
const { hashPassword } = require('./authService');

const createEmployee = async (data) => {
  const hashedPassword = await hashPassword(data.password);

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        employeeCode: data.employeeCode,
        fullName: data.fullName,
        email: data.email,
        mobile: data.mobile,
        username: data.username,
        password: hashedPassword,
        department: data.department,
        designation: data.designation,
        joiningDate: new Date(data.joiningDate)
      }
    });

    await tx.employeeSettings.create({
      data: {
        employeeId: emp.id,
        dutyDuration: data.dutyDuration || 540,
        breakAllowance: data.breakAllowance || 60
      }
    });

    return emp;
  });

  const result = await prisma.employee.findUnique({
    where: { id: employee.id },
    include: { settings: true },
    omit: { password: true }
  });

  return result;
};

const getAllEmployees = async (filters = {}) => {
  const where = {};

  if (filters.department) where.department = filters.department;
  if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true';
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search } },
      { employeeCode: { contains: filters.search } },
      { email: { contains: filters.search } },
      { department: { contains: filters.search } }
    ];
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { settings: true },
      omit: { password: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.employee.count({ where })
  ]);

  return {
    employees,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const getEmployeeById = async (id) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { settings: true },
    omit: { password: true }
  });

  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { statusCode: 404 });
  }

  return employee;
};

const updateEmployee = async (id, data) => {
  const updateData = {};
  const settingsData = {};

  if (data.fullName) updateData.fullName = data.fullName;
  if (data.email) updateData.email = data.email;
  if (data.mobile) updateData.mobile = data.mobile;
  if (data.department) updateData.department = data.department;
  if (data.designation) updateData.designation = data.designation;
  if (data.profileImage) updateData.profileImage = data.profileImage;

  if (data.dutyDuration) settingsData.dutyDuration = data.dutyDuration;
  if (data.breakAllowance !== undefined) settingsData.breakAllowance = data.breakAllowance;

  const result = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.update({
      where: { id },
      data: updateData
    });

    if (Object.keys(settingsData).length > 0) {
      await tx.employeeSettings.upsert({
        where: { employeeId: id },
        update: settingsData,
        create: { employeeId: id, ...settingsData }
      });
    }

    return emp;
  });

  return getEmployeeById(id);
};

const toggleEmployeeStatus = async (id) => {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { statusCode: 404 });
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: { isActive: !employee.isActive },
    omit: { password: true }
  });

  return updated;
};

const resetEmployeePassword = async (id, newPassword) => {
  const hashedPassword = await hashPassword(newPassword);
  await prisma.employee.update({
    where: { id },
    data: { password: hashedPassword }
  });

  await prisma.refreshToken.updateMany({
    where: { userId: id, userType: 'employee' },
    data: { isRevoked: true }
  });
};

const getDepartments = async () => {
  const departments = await prisma.employee.findMany({
    select: { department: true },
    distinct: ['department']
  });
  return departments.map(d => d.department);
};

module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  toggleEmployeeStatus,
  resetEmployeePassword,
  getDepartments
};

const bcrypt = require('bcrypt');
const prisma = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');

const SALT_ROUNDS = 12;

const adminLogin = async (username, password) => {
  const admin = await prisma.admin.findFirst({
    where: { OR: [{ username }, { email: username }] }
  });

  if (!admin || !admin.isActive) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const isValid = await bcrypt.compare(password, admin.password);
  if (!isValid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const tokenPayload = { id: admin.id, role: 'admin', name: admin.name };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: admin.id,
      userType: 'admin',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    accessToken,
    refreshToken,
    user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' }
  };
};

const employeeLogin = async (username, password) => {
  const employee = await prisma.employee.findFirst({
    where: { OR: [{ username }, { email: username }] }
  });

  if (!employee || !employee.isActive) {
    throw Object.assign(new Error('Invalid credentials or account deactivated'), { statusCode: 401 });
  }

  const isValid = await bcrypt.compare(password, employee.password);
  if (!isValid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const settings = await prisma.employeeSettings.findUnique({
    where: { employeeId: employee.id }
  });

  const tokenPayload = { id: employee.id, role: 'employee', name: employee.fullName, employeeCode: employee.employeeCode };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: employee.id,
      userType: 'employee',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.employee.update({
    where: { id: employee.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      department: employee.department,
      designation: employee.designation,
      profileImage: employee.profileImage,
      role: 'employee',
      settings: settings || { dutyDuration: 540, breakAllowance: 60 }
    }
  };
};

const refreshAccessToken = async (token) => {
  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });

  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const decoded = verifyRefreshToken(token);
  const newAccessToken = generateAccessToken({
    id: decoded.id,
    role: decoded.role,
    name: decoded.name,
    employeeCode: decoded.employeeCode
  });

  return { accessToken: newAccessToken };
};

const logout = async (refreshToken) => {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true }
    });
  }
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

module.exports = {
  adminLogin,
  employeeLogin,
  refreshAccessToken,
  logout,
  hashPassword
};

import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/passwordHash';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { LoginDto, RegisterDto, ChangePasswordDto, RefreshTokenDto } from '../types';

export class AuthService {
  async register(data: RegisterDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw ApiError.badRequest('User with this email already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role || 'WORKER',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async login(data: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account is inactive');
    }

    const isPasswordValid = await comparePassword(data.password, user.password);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(data.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw ApiError.badRequest('Trenutna lozinka nije ispravna');
    }

    // Check that new password is different
    if (data.currentPassword === data.newPassword) {
      throw ApiError.badRequest('Nova lozinka mora biti različita od trenutne lozinke');
    }

    // Validate new password length
    if (data.newPassword.length < 6) {
      throw ApiError.badRequest('Nova lozinka mora imati najmanje 6 karaktera');
    }

    // Hash and update password
    const hashedNewPassword = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    return { message: 'Lozinka je uspješno promijenjena' };
  }

  async refreshToken(data: RefreshTokenDto) {
    try {
      // Verify the refresh token
      const payload = verifyRefreshToken(data.refreshToken);

      // Check if user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      if (!user.isActive) {
        throw ApiError.forbidden('Account is inactive');
      }

      // Generate new tokens
      const newPayload = { id: user.id, email: user.email, role: user.role };
      const accessToken = generateAccessToken(newPayload);
      const refreshToken = generateRefreshToken(newPayload);

      return {
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      // JWT verification failed (expired or invalid)
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  }
}

export default new AuthService();

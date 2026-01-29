import { Request } from 'express';
import { Role } from '../../generated/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: Role;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Equipment Type DTOs
export interface CreateEquipmentTypeDto {
  name: string;
  description?: string;
}

export interface UpdateEquipmentTypeDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// Equipment DTOs
export interface CreateEquipmentDto {
  name: string;
  description?: string;
  typeId: string;
  quantity?: number; // null = individual item, number = quantity-based
}

export interface UpdateEquipmentDto {
  name?: string;
  description?: string;
  typeId?: string;
  quantity?: number;
  isActive?: boolean;
}

// Work Order Equipment DTOs
export interface WorkOrderEquipmentDto {
  equipmentId: string;
  quantity: number;
}

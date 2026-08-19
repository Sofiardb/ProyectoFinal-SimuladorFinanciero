import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { AuthResponse, Usuario } from '@/types'

export interface LoginPayload {
  identificador: string
  password: string
}

export interface RegisterPayload {
  email:     string
  username:  string
  password:  string
  nombre?:   string
  apellido?: string
}

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      api.post<AuthResponse>('/auth/login', payload),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      api.post<{ message: string }>('/auth/register', payload),
  })
}

export interface ResendVerificationPayload {
  identificador: string
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (payload: ResendVerificationPayload) =>
      api.post<{ message: string }>('/auth/resend-verification', payload),
  })
}

export interface ForgotPasswordPayload {
  identificador: string
}

export interface ForgotPasswordResult {
  maskedEmail: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) =>
      api.post<ForgotPasswordResult>('/auth/forgot-password', payload),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) =>
      api.post<{ message: string }>('/auth/reset-password', payload),
  })
}

export interface UpdatePerfilPayload {
  email:     string
  username:  string
  nombre?:   string
  apellido?: string
}

export function useUpdatePerfil() {
  return useMutation({
    mutationFn: (payload: UpdatePerfilPayload) =>
      api.put<Usuario>('/auth/me', payload),
  })
}

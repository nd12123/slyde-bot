// src/services/supabaseService.ts
// Service for Supabase integration - delegates to edge function

import dotenv from 'dotenv';
import axios from 'axios';

// Ensure environment variables are loaded
dotenv.config();

const SUPABASE_URL = process.env.DATABASE_URL || 'https://cpbodmxgevxxvtkyjofz.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auth-telegram`;

console.log('✅ [SupabaseService] Using Supabase Edge Function for authentication');
console.log(`📍 [SupabaseService] Edge function URL: ${EDGE_FUNCTION_URL}`);

class SupabaseService {
  constructor() {
    // Service is initialized with just the edge function URL
  }

  /**
   * Authenticate or create a Telegram user via Supabase Edge Function
   * Calls the auth-telegram edge function which handles:
   * - User creation in Supabase Auth
   * - Profile creation in public.profiles
   * - User preferences initialization
   * - Session generation
   */
  async authenticateTelegramUser(telegramId: number): Promise<{
    success: boolean;
    user?: {
      user_id: string;
      email: string;
      username: string;
      full_name: string;
      avatar_url: string | null;
      id_verified: boolean;
      onboarding_completed: boolean;
      account_status: string;
      created_at: string;
      telegram_id: number;
    };
    session?: {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      expires_at: number;
      user: any;
    };
    error?: string;
  }> {
    try {
      console.log(`🔐 [SupabaseService] Authenticating Telegram user: ${telegramId}`);

      // Call the edge function
      const response = await axios.post(EDGE_FUNCTION_URL, {
        telegramId,
      });

      console.log(`✅ [SupabaseService] Edge function response successful for TG ${telegramId}`);

      return {
        success: true,
        user: response.data.user,
        session: response.data.session,
      };
    } catch (err: any) {
      console.error('❌ [SupabaseService] Error during Telegram authentication:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });

      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Authentication failed',
      };
    }
  }

}

export const supabaseService = new SupabaseService();
export default supabaseService;

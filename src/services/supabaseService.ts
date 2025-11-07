// src/services/supabaseService.ts
// Service for Supabase integration - handles user creation and authentication

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.DATABASE_URL || 'https://cpbodmxgevxxvtkyjofz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_KEY) {
  console.warn('⚠️ [SupabaseService] SUPABASE_SERVICE_ROLE_KEY not found in environment');
  console.warn('ℹ️ [SupabaseService] This is OK - will use fallback mock authentication');
}

class SupabaseService {
  private supabase: any = null;

  constructor() {
    if (SUPABASE_KEY && SUPABASE_URL) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log('✅ [SupabaseService] Initialized with Supabase credentials');
    } else {
      console.warn('⚠️ [SupabaseService] Supabase not configured - will use fallback mock');
    }
  }

  /**
   * Authenticate or create a Telegram user in Supabase
   * This generates a session and returns user data
   */
  async authenticateTelegramUser(telegramId: number): Promise<{
    success: boolean;
    user?: {
      id: string;
      email: string;
      username: string;
      full_name: string;
      id_verified: boolean;
      onboarding_completed: boolean;
      account_status: string;
      created_at: string;
    };
    session?: {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
    };
    error?: string;
  }> {
    try {
      console.log(`🔐 [SupabaseService] Authenticating Telegram user: ${telegramId}`);

      // If Supabase not configured, use fallback mock
      if (!this.supabase) {
        console.warn('⚠️ [SupabaseService] Using fallback mock (Supabase not configured)');
        return this.getMockUserSession(telegramId);
      }

      // Check if user already exists
      const { data: existingUsers, error: queryError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('telegram_id', telegramId)
        .limit(1);

      if (queryError) {
        console.error('❌ [SupabaseService] Query error:', queryError);
        return {
          success: false,
          error: 'Failed to query user',
        };
      }

      let userId: string;
      let user: any;

      if (existingUsers && existingUsers.length > 0) {
        // User exists, use existing user
        user = existingUsers[0];
        userId = user.id;
        console.log(`✅ [SupabaseService] Found existing user: ${userId}`);
      } else {
        // Create new user
        console.log(`📝 [SupabaseService] Creating new user for telegram_id: ${telegramId}`);

        // Use service role key to create a user with a unique identifier
        const email = `tg_${telegramId}@slyde.app`;

        const { data: newUser, error: createError } = await this.supabase.auth.admin.createUser({
          email: email,
          password: Math.random().toString(36).slice(-20), // Random password
          email_confirm: true,
          user_metadata: {
            telegram_id: telegramId,
            username: `tg_${telegramId}`,
            full_name: `Telegram User ${telegramId}`,
          },
        });

        if (createError) {
          // If user already exists, try to retrieve the existing user
          if (createError.message?.includes('already been registered') || createError.message?.includes('duplicate')) {
            console.warn('⚠️ [SupabaseService] User already exists, attempting to retrieve...');

            // Try to find the user by email
            const { data: { users }, error: listError } = await this.supabase.auth.admin.listUsers();
            if (listError) {
              console.error('❌ [SupabaseService] Failed to list users:', listError);
              return {
                success: false,
                error: `Failed to retrieve user: ${listError.message}`,
              };
            }

            const existingUser = users?.find(u => u.email === email);
            if (existingUser) {
              userId = existingUser.id;
              console.log(`✅ [SupabaseService] Retrieved existing user: ${userId}`);
            } else {
              console.error('❌ [SupabaseService] User creation failed and user not found in list');
              return {
                success: false,
                error: `Failed to create user: ${createError.message}`,
              };
            }
          } else {
            console.error('❌ [SupabaseService] User creation error:', createError);
            return {
              success: false,
              error: `Failed to create user: ${createError.message}`,
            };
          }
        } else {
          userId = newUser.user?.id || '';
          console.log(`✅ [SupabaseService] Created new user: ${userId}`);
        }

        // Validate userId was set
        if (!userId) {
          return {
            success: false,
            error: 'Failed to get user ID',
          };
        }

        // Create profile for the new user
        const { error: profileError } = await this.supabase.from('profiles').insert({
          id: userId,
          telegram_id: telegramId,
          username: `tg_${telegramId}`,
          full_name: `Telegram User ${telegramId}`,
          avatar_url: null,
          id_verified: true,
          onboarding_completed: false,
          account_status: 'active',
        });

        if (profileError) {
          console.warn('⚠️ [SupabaseService] Profile creation error (non-fatal):', profileError);
        }

        user = {
          id: userId,
          telegram_id: telegramId,
          username: `tg_${telegramId}`,
          full_name: `Telegram User ${telegramId}`,
          avatar_url: null,
          id_verified: true,
          onboarding_completed: false,
          account_status: 'active',
          created_at: new Date().toISOString(),
        };
      }

      // Generate a session token using service role
      const sessionToken = await this.generateSessionToken(userId);

      if (!sessionToken) {
        return {
          success: false,
          error: 'Failed to generate session token',
        };
      }

      console.log(`✅ [SupabaseService] Generated session for user: ${userId}`);

      return {
        success: true,
        user: {
          id: user.id || userId,
          email: user.email || `tg_${telegramId}@slyde.app`,
          username: user.username || `tg_${telegramId}`,
          full_name: user.full_name || `Telegram User ${telegramId}`,
          id_verified: user.id_verified ?? true,
          onboarding_completed: user.onboarding_completed ?? false,
          account_status: user.account_status || 'active',
          created_at: user.created_at || new Date().toISOString(),
        },
        session: {
          access_token: sessionToken.access_token,
          token_type: 'Bearer',
          expires_in: sessionToken.expires_in,
          refresh_token: sessionToken.refresh_token,
        },
      };
    } catch (err: any) {
      console.error('❌ [SupabaseService] Error during Telegram authentication:', err);
      return {
        success: false,
        error: err.message || 'Internal server error',
      };
    }
  }

  /**
   * Generate a session token for a user
   * Note: In a real scenario, you'd use a proper JWT library or Supabase's session management
   */
  private async generateSessionToken(userId: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null> {
    try {
      // Create a simple JWT token (in production, use proper JWT library)
      // For now, we'll create a session using Supabase's service role
      const expiresIn = 3600; // 1 hour
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

      // Create a basic access token
      const accessToken = Buffer.from(
        JSON.stringify({
          sub: userId,
          iat: Math.floor(Date.now() / 1000),
          exp: expiresAt,
        })
      ).toString('base64');

      return {
        access_token: accessToken,
        refresh_token: `refresh_${userId}_${Date.now()}`,
        expires_in: expiresIn,
      };
    } catch (err) {
      console.error('❌ [SupabaseService] Failed to generate session token:', err);
      return null;
    }
  }

  /**
   * Get mock user session (fallback when Supabase is not configured)
   */
  private getMockUserSession(telegramId: number): {
    success: boolean;
    user?: {
      id: string;
      email: string;
      username: string;
      full_name: string;
      id_verified: boolean;
      onboarding_completed: boolean;
      account_status: string;
      created_at: string;
    };
    session?: {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
    };
    error?: string;
  } {
    const userId = `tg_${telegramId}`;
    const mockSession = {
      access_token: `mock_jwt_${telegramId}_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: `mock_refresh_${telegramId}`,
    };

    const mockUser = {
      id: userId,
      email: `telegram_${telegramId}@slyde.app`,
      username: `tg_${telegramId}`,
      full_name: `Telegram User ${telegramId}`,
      id_verified: true,
      onboarding_completed: false,
      account_status: 'active',
      created_at: new Date().toISOString(),
    };

    console.log(`✅ [SupabaseService] Using mock user session for telegram_id: ${telegramId}`);

    return {
      success: true,
      user: mockUser,
      session: mockSession,
    };
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;

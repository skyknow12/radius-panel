import { query } from '../db/pool';
import { auditRepository } from './audit.repository';

export interface UserPreferencesItem {
  id: number;
  user_id: string;
  theme: string;
  appearance_mode: string;
  sidebar_collapsed: boolean;
  custom_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AppearanceSettingsData {
  userTheme: string;
  orgTheme: string;
  effectiveTheme: string;
  appearanceMode: string;
  logoUrl: string | null;
  brandName: string;
  brandSubtitle: string;
  orgName: string;
  orgId?: number;
}

export class SettingsRepository {
  /**
   * Fetch user preferences for a given user ID
   */
  async getUserPreferences(userId: string): Promise<UserPreferencesItem | null> {
    const { rows } = await query<UserPreferencesItem>(`
      SELECT id, user_id, theme, appearance_mode, sidebar_collapsed, custom_settings, created_at, updated_at
        FROM user_preferences
       WHERE user_id = $1
    `, [userId]);
    return rows[0] || null;
  }

  /**
   * Save or update user preferences
   */
  async saveUserPreferences(
    userId: string,
    input: {
      theme?: string;
      appearance_mode?: string;
      sidebar_collapsed?: boolean;
      custom_settings?: Record<string, unknown>;
    }
  ): Promise<UserPreferencesItem> {
    const theme = input.theme || 'default';
    const mode = input.appearance_mode || 'dark';
    const collapsed = input.sidebar_collapsed !== undefined ? input.sidebar_collapsed : false;
    const custom = JSON.stringify(input.custom_settings || {});

    const { rows } = await query<UserPreferencesItem>(`
      INSERT INTO user_preferences (user_id, theme, appearance_mode, sidebar_collapsed, custom_settings)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (user_id) DO UPDATE
         SET theme = COALESCE(EXCLUDED.theme, user_preferences.theme),
             appearance_mode = COALESCE(EXCLUDED.appearance_mode, user_preferences.appearance_mode),
             sidebar_collapsed = COALESCE(EXCLUDED.sidebar_collapsed, user_preferences.sidebar_collapsed),
             custom_settings = COALESCE(EXCLUDED.custom_settings, user_preferences.custom_settings),
             updated_at = NOW()
      RETURNING *
    `, [userId, theme, mode, collapsed, custom]);

    return rows[0];
  }

  /**
   * Get consolidated Appearance Settings based on:
   * 1. User theme (highest priority)
   * 2. Organization default theme
   * 3. System default ('default')
   */
  async getAppearanceSettings(userId?: string): Promise<AppearanceSettingsData> {
    // 1. Fetch organization branding & default theme
    const orgRes = await query<{
      id: number;
      name: string;
      logo_url: string | null;
      brand_name: string | null;
      brand_subtitle: string | null;
      settings: any;
    }>(`
      SELECT id, name, logo_url,
             COALESCE(brand_name, 'SKY RADIUS') AS brand_name,
             COALESCE(brand_subtitle, 'ISP Operations') AS brand_subtitle,
             settings
        FROM organizations
       ORDER BY id ASC LIMIT 1
    `);

    const org = orgRes.rows[0];
    const orgTheme = org?.settings?.default_theme || 'default';
    const logoUrl = org?.logo_url || null;
    const brandName = org?.brand_name || 'SKY RADIUS';
    const brandSubtitle = org?.brand_subtitle || 'ISP Operations';
    const orgName = org?.name || 'Primary ISP Organization';

    // 2. Fetch user preferences if user is authenticated
    let userTheme = '';
    let appearanceMode = 'dark';

    if (userId) {
      const userPref = await this.getUserPreferences(userId);
      if (userPref) {
        userTheme = userPref.theme;
        appearanceMode = userPref.appearance_mode || 'dark';
      }
    }

    // Determine effective theme
    const effectiveTheme = userTheme || orgTheme || 'default';

    return {
      userTheme: userTheme || 'default',
      orgTheme,
      effectiveTheme,
      appearanceMode,
      logoUrl,
      brandName,
      brandSubtitle,
      orgName,
      orgId: org?.id,
    };
  }

  /**
   * Update Organization Appearance & Logo
   */
  async updateOrganizationAppearance(
    input: {
      default_theme?: string;
      logo_url?: string | null;
      brand_name?: string;
      brand_subtitle?: string;
    },
    operator: string
  ): Promise<AppearanceSettingsData> {
    const orgRes = await query<{ id: number; settings: any }>(`
      SELECT id, settings FROM organizations ORDER BY id ASC LIMIT 1
    `);
    const org = orgRes.rows[0];
    if (!org) {
      throw new Error('Organization not found');
    }

    const currentSettings = org.settings || {};
    if (input.default_theme !== undefined) {
      currentSettings.default_theme = input.default_theme;
    }

    const fields: string[] = ['settings = $1', 'updated_at = NOW()'];
    const values: any[] = [JSON.stringify(currentSettings)];
    let idx = 2;

    if (input.logo_url !== undefined) {
      fields.push(`logo_url = $${idx++}`);
      values.push(input.logo_url);
    }
    if (input.brand_name !== undefined) {
      fields.push(`brand_name = $${idx++}`);
      values.push(input.brand_name);
    }
    if (input.brand_subtitle !== undefined) {
      fields.push(`brand_subtitle = $${idx++}`);
      values.push(input.brand_subtitle);
    }

    values.push(org.id);
    await query(`
      UPDATE organizations
         SET ${fields.join(', ')}
       WHERE id = $${idx}
    `, values);

    await auditRepository.insert({
      username: operator,
      action: 'appearance.update',
      entityType: 'organization',
      entityId: String(org.id),
      status: 'success',
      metadata: {
        default_theme: input.default_theme,
        has_custom_logo: !!input.logo_url,
        brand_name: input.brand_name,
      },
    }).catch(() => undefined);

    return this.getAppearanceSettings();
  }
}

export const settingsRepository = new SettingsRepository();

import { query } from '../../db/pool';
import { decryptSecret, encryptSecret } from '../../lib/crypto';
import type { ResolvedOnuCredentials } from './types';

export class CredentialService {
  /**
   * Resolve effective management credentials for an ONU adhering to precedence:
   * Device > Branch > Model Profile > Global Default
   */
  async resolveCredentials(params: {
    onuId: number;
    profileId?: number | null;
    branchId?: number | null;
  }): Promise<ResolvedOnuCredentials | null> {
    const { onuId, profileId, branchId } = params;

    // 1. Device-specific credential
    const devRes = await query<{ id: number; username: string; password_encrypted: string }>(
      `SELECT id, username, password_encrypted
         FROM onu_credential_profiles
        WHERE scope = 'device' AND onu_id = $1
        ORDER BY id DESC LIMIT 1`,
      [onuId]
    );

    if (devRes.rows[0]) {
      const row = devRes.rows[0];
      return {
        username: row.username,
        passwordDecrypted: decryptSecret(row.password_encrypted),
        sourceScope: 'device',
        credentialId: row.id,
      };
    }

    // 2. Branch-specific credential
    if (branchId) {
      let branchQuery = `
        SELECT id, username, password_encrypted
          FROM onu_credential_profiles
         WHERE scope = 'branch' AND branch_id = $1
      `;
      const branchParams: any[] = [branchId];

      if (profileId) {
        branchQuery += ` AND (profile_id = $2 OR profile_id IS NULL) ORDER BY profile_id NULLS LAST, id DESC LIMIT 1`;
        branchParams.push(profileId);
      } else {
        branchQuery += ` ORDER BY id DESC LIMIT 1`;
      }

      const branchRes = await query<{ id: number; username: string; password_encrypted: string }>(
        branchQuery,
        branchParams
      );

      if (branchRes.rows[0]) {
        const row = branchRes.rows[0];
        return {
          username: row.username,
          passwordDecrypted: decryptSecret(row.password_encrypted),
          sourceScope: 'branch',
          credentialId: row.id,
        };
      }
    }

    // 3. Model Profile defaults
    if (profileId) {
      const profCredRes = await query<{ id: number; username: string; password_encrypted: string }>(
        `SELECT id, username, password_encrypted
           FROM onu_credential_profiles
          WHERE scope = 'model' AND profile_id = $1
          ORDER BY id DESC LIMIT 1`,
        [profileId]
      );

      if (profCredRes.rows[0]) {
        const row = profCredRes.rows[0];
        return {
          username: row.username,
          passwordDecrypted: decryptSecret(row.password_encrypted),
          sourceScope: 'model',
          credentialId: row.id,
        };
      }

      const profRes = await query<{ default_username: string; default_password_encrypted: string | null }>(
        `SELECT default_username, default_password_encrypted
           FROM onu_model_profiles
          WHERE id = $1`,
        [profileId]
      );

      if (profRes.rows[0]) {
        const p = profRes.rows[0];
        if (p.default_password_encrypted) {
          return {
            username: p.default_username || 'telecomadmin',
            passwordDecrypted: decryptSecret(p.default_password_encrypted),
            sourceScope: 'model',
          };
        }
      }
    }

    // 4. Global fallback credential
    const globRes = await query<{ id: number; username: string; password_encrypted: string }>(
      `SELECT id, username, password_encrypted
         FROM onu_credential_profiles
        WHERE scope = 'global'
        ORDER BY id DESC LIMIT 1`
    );

    if (globRes.rows[0]) {
      const row = globRes.rows[0];
      return {
        username: row.username,
        passwordDecrypted: decryptSecret(row.password_encrypted),
        sourceScope: 'global',
        credentialId: row.id,
      };
    }

    return null;
  }

  /**
   * Encrypt a password for secure storage
   */
  encryptPassword(password: string): string {
    return encryptSecret(password);
  }

  /**
   * Safely decrypt a stored password
   */
  decryptPassword(encrypted: string): string {
    return decryptSecret(encrypted);
  }

  /**
   * Helper to mask stored password for API responses
   */
  maskSecret(_secret?: string | null): string {
    return '••••••••';
  }
}

export const credentialService = new CredentialService();

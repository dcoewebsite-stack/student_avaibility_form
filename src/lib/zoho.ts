export interface ZohoContactPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  organization?: string;
  designation?: string;
  city?: string;
  attendance_preference?: string;
  total_points?: number;
  modules_interested?: string[];
  modules_completed?: string[];
}

export async function getZohoAccessToken(): Promise<string | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com';

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[Zoho CRM] Missing credentials in environment variables. Operating in simulation mode.');
    return null;
  }

  try {
    const url = `${accountsDomain}/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();

    if (data.access_token) {
      return data.access_token;
    } else {
      console.error('[Zoho CRM OAuth Error]', data);
      return null;
    }
  } catch (error) {
    console.error('[Zoho CRM Auth Error]', error);
    return null;
  }
}

export async function syncLeadToZoho(payload: ZohoContactPayload): Promise<{ success: boolean; zohoId?: string; error?: string }> {
  const token = await getZohoAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';

  if (!token) {
    // Simulated success mode if credentials are not configured yet
    console.log('[Zoho CRM Simulation] Pushed lead payload:', payload);
    return {
      success: true,
      zohoId: `SIMULATED_ZOHO_${Date.now()}`,
    };
  }

  try {
    const record = {
      First_Name: payload.first_name,
      Last_Name: payload.last_name || 'N/A',
      Email: payload.email,
      Phone: payload.phone || '',
      Company: payload.organization || 'Individual',
      Designation: payload.designation || '',
      City: payload.city || '',
      Lead_Source: 'Gamified Form Platform (D-CoE)',
      Description: `Attendance Preference: ${payload.attendance_preference || 'In-Person'}. Earned Points: ${payload.total_points || 0}. Interested Modules: ${payload.modules_interested?.join(', ') || 'None'}. Completed Modules: ${payload.modules_completed?.join(', ') || 'None'}.`,
    };

    const res = await fetch(`${apiDomain}/crm/v2/Leads/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [record],
        duplicate_check_fields: ['Email'],
      }),
    });

    const result = await res.json();
    if (result.data && result.data[0] && (result.data[0].status === 'success' || result.data[0].status === 'duplicate')) {
      return {
        success: true,
        zohoId: result.data[0].details?.id,
      };
    } else {
      return {
        success: false,
        error: JSON.stringify(result),
      };
    }
  } catch (err: any) {
    console.error('[Zoho CRM Sync Error]', err);
    return {
      success: false,
      error: err.message || 'Network failure syncing to Zoho CRM',
    };
  }
}

import { google } from 'googleapis'
import prisma from './prisma'

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

export function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    )
}

export function getAuthUrl(userId: string) {
    const oauth2Client = getOAuth2Client()
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: userId,
        prompt: 'consent',
    })
}

export async function getTokensFromCode(code: string) {
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    return tokens
}

export async function getCalendarEvents(userId: string, timeMin: Date, timeMax: Date) {
    const tokenRecord = await prisma.userToken.findUnique({
        where: { userId_provider: { userId, provider: 'google' } },
    })

    if (!tokenRecord) {
        throw new Error('Google Calendar not connected')
    }

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({
        access_token: tokenRecord.accessToken,
        refresh_token: tokenRecord.refreshToken,
        expiry_date: tokenRecord.expiryDate?.getTime(),
    })

    // Auto-refresh if expired
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token || tokens.refresh_token || tokens.expiry_date) {
            await prisma.userToken.update({
                where: { id: tokenRecord.id },
                data: {
                    accessToken: tokens.access_token ?? tokenRecord.accessToken,
                    refreshToken: tokens.refresh_token ?? tokenRecord.refreshToken,
                    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : tokenRecord.expiryDate,
                },
            })
        }
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
    })

    return response.data.items || []
}
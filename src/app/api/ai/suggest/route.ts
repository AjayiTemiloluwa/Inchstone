import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { itemId, goalTitle, layer, parentTitle } = body

        if (!itemId || !goalTitle || typeof layer !== 'number') {
            return NextResponse.json({ error: 'itemId, goalTitle, and layer are required' }, { status: 400 })
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'AI features are not configured on this server.' }, { status: 501 })
        }

        // Determine what to suggest based on layer
        let prompt = ''
        if (layer === 1 || layer === 2) { // Category or Yearly Goal
            prompt = `I have a yearly goal titled "${goalTitle}". Break this down into 3-4 logical, measurable, and sequential quarterly milestones (Quarterly Goals). Respond ONLY with a JSON array of strings representing the milestone titles.`
        } else if (layer === 3) { // Quarterly Goal
            prompt = `My quarterly goal is "${goalTitle}" (part of "${parentTitle || 'a larger plan'}"). Break this down into 3 monthly goals. Respond ONLY with a JSON array of strings representing the monthly goal titles.`
        } else if (layer === 4) { // Monthly Goal
            prompt = `My monthly goal is "${goalTitle}" (part of "${parentTitle || 'a larger plan'}"). Break this down into 4 weekly action-oriented wins. Respond ONLY with a JSON array of strings representing the weekly win titles.`
        } else {
            return NextResponse.json({ error: 'AI Suggestions are not supported for this goal layer.' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const result = await model.generateContent(prompt)
        const responseText = result.response.text()
        
        let suggestionsList: string[] = []
        try {
            // Strip markdown formatting if the LLM wrapped it in ```json
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
            suggestionsList = JSON.parse(cleanText)
        } catch (e) {
            console.error('Failed to parse AI response:', responseText)
            return NextResponse.json({ error: 'AI returned an invalid format.' }, { status: 500 })
        }

        if (!Array.isArray(suggestionsList) || suggestionsList.length === 0) {
            return NextResponse.json({ error: 'AI did not return any suggestions.' }, { status: 500 })
        }

        // Create PendingSuggestions in the DB
        const createdSuggestions = []
        for (const title of suggestionsList) {
            const suggestion = await prisma.pendingSuggestion.create({
                data: {
                    fromUserId: 'system-ai',
                    toUserId: userId,
                    itemId,
                    suggestedTitle: title,
                }
            })
            createdSuggestions.push(suggestion)
        }

        return NextResponse.json({ success: true, suggestions: createdSuggestions })
    } catch (error) {
        console.error('Failed to generate suggestions', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
